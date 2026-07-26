import { isEqual, throttle } from 'lodash-es';
import Masonry from 'masonry-layout';

import type { ViewDisplayConfig } from '../config/schema/common/display';
import {
  forceReflow,
  getChildrenFromElement,
  setOrRemoveStyleProperty,
} from '../utils/basic';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event';

// The default minimum cell width: if the columns are not specified this value
// is used to compute the number of columns, always trying to keep each cell as
// at least this width. On Android, a card in portrait mode is 396 pixels, and
// we'd like to support two cells wide in that configuration.
const MEDIA_GRID_DEFAULT_MIN_CELL_WIDTH = 190;
const MEDIA_GRID_DEFAULT_IDEAL_CELL_WIDTH = 600;
const MEDIA_GRID_DEFAULT_SELECTED_WIDTH_FACTOR = 2.0;
const MEDIA_GRID_HORIZONTAL_GUTTER_WIDTH = 1;

type GridID = string;
type MediaGridChild = HTMLElement;
type MediaGridContents = Map<GridID, MediaGridChild>;

export interface MediaGridSelected {
  selected: GridID;
}

export interface MediaGridConstructorOptions {
  selected?: GridID;
  idAttribute?: string;
  widthFactorAttribute?: string;
  displayConfig?: ViewDisplayConfig;
}

export interface ExtendedMasonry extends Masonry {
  // Expose the items array to allow for custom ordering (used for the
  // `grid_selected_position` parameter).
  items: {
    element: MediaGridChild;
  }[];
}

export class MediaGridController {
  private _host: HTMLElement;

  private _selected: GridID | null;
  private _gridContents: MediaGridContents = new Map();
  private _masonry: ExtendedMasonry | null = null;
  private _displayConfig: ViewDisplayConfig | null = null;
  private _hostWidth: number;
  private _idAttribute: string;
  private _widthFactorAttribute: string;

  private _throttledLayout = throttle(() => this._masonry?.layout?.(), 300, {
    leading: true,
    trailing: true,
  });

  // If the order in which the observers are declared changes, the unittest must
  // be updated in triggerResizeObserver and triggerMutationObserver.
  private _hostMutationObserver = new MutationObserver(
    this._hostMutationHandler.bind(this),
  );
  private _cellMutationObserver = new MutationObserver(
    this._cellMutationHandler.bind(this),
  );
  private _hostResizeObserver = new ResizeObserver(this._hostResizeHandler.bind(this));
  private _cellResizeObserver = new ResizeObserver(this._cellResizeHandler.bind(this));

  constructor(host: HTMLElement, options?: MediaGridConstructorOptions) {
    this._host = host;
    this._selected = options?.selected ?? null;
    this._idAttribute = options?.idAttribute ?? 'grid-id';
    this._widthFactorAttribute = options?.widthFactorAttribute ?? 'grid-width-factor';
    this._hostWidth = this._host.getBoundingClientRect().width;
    this._hostResizeObserver.observe(host);
    this._displayConfig = options?.displayConfig ?? null;

    this._hostMutationObserver.observe(host, {
      childList: true,
    });

    // Need to separately listen for slotchanges since mutation observer will
    // not be called for shadom DOM slotted changes.
    if (host instanceof HTMLSlotElement) {
      host.addEventListener('slotchange', this._setGridContentsFromHost);
    }
    this._setGridContentsFromHost();
  }

  public destroy(): void {
    this._hostResizeObserver.disconnect();
    this._cellResizeObserver.disconnect();

    this._hostMutationObserver.disconnect();
    this._cellMutationObserver.disconnect();

    if (this._host instanceof HTMLSlotElement) {
      this._host.removeEventListener('slotchange', this._setGridContentsFromHost);
    }

    this._masonry?.destroy?.();
    this._masonry = null;

    for (const child of this._gridContents.values()) {
      this._removeChildEventListeners(child);
    }
    this._gridContents.clear();
  }

  public setDisplayConfig(displayConfig: ViewDisplayConfig | null): void {
    if (!isEqual(displayConfig, this._displayConfig)) {
      this._displayConfig = displayConfig;

      // The cells are unchanged, but the config drives both their order and
      // their size.
      this._sortItemsInGrid();
      this._applyCellSize();
    }
  }

  public getGridContents(): MediaGridContents {
    return this._gridContents;
  }

  public getGridSize(): number {
    return this._gridContents.size;
  }

  public getSelected(): GridID | null {
    return this._selected;
  }

  private _sortItemsInGrid(): void {
    const masonry = this._masonry;
    if (!masonry) {
      return;
    }

    // Implementation note: With the latest version of the Masonry library
    // (4.2.2) using the prepended() and appended() methods in quick succession
    // causes the layout to not show the newly added items. Instead, access the
    // items in place and swap them around.
    //
    // Order is always derived from the grid contents rather than from the
    // current item order, which may be the result of an earlier sort against a
    // different selection or `grid_selected_position`.
    const cells = [...this._gridContents.values()];
    const sortedItems = [...masonry.items].sort(
      (a, b) => cells.indexOf(a.element) - cells.indexOf(b.element),
    );

    // If `grid_selected_position` is set to 'first' or 'last', move the
    // selected item to the start or end of the list respectively.
    const selectedPosition = this._displayConfig?.grid_selected_position;
    const selectedItem = sortedItems.find(
      (item) => item.element.getAttribute(this._idAttribute) === this._selected,
    );

    if (selectedItem && (selectedPosition === 'first' || selectedPosition === 'last')) {
      const otherItems = sortedItems.filter((item) => item !== selectedItem);
      masonry.items =
        selectedPosition === 'first'
          ? [selectedItem, ...otherItems]
          : [...otherItems, selectedItem];
    } else {
      masonry.items = sortedItems;
    }
  }

  public selectCell(id: GridID) {
    // Applies a selection to the grid. Does NOT fire `media-grid:selected` --
    // that event signals a user-initiated request to navigate; it is fired
    // from the click handler. Calling here would either double-fire (when
    // selectCell is invoked in response to an accepted navigation) or be a
    // lie (when invoked imperatively by code).
    if (this._selected === id) {
      return;
    }

    this._selected = id;

    this._sortItemsInGrid();
    this._updateSelectedStylesOnElements();

    this._forceLayout();
  }

  public unselectAll() {
    if (this._selected !== null) {
      fireAdvancedCameraCardEvent(this._host, 'media-grid:unselected');
    }
    this._selected = null;
    this._updateSelectedStylesOnElements();

    this._forceLayout();
  }

  protected _forceLayout(): void {
    // Cancel possible pending layout
    this._throttledLayout.cancel();

    // Force browser reflow so masonry measures the updated element size
    forceReflow(this._host);

    // Sizes and positions may change when an element is selected, so re-do the layout
    this._masonry?.layout?.();
  }

  private _setGridContentsFromHost = (): void => {
    const children = getChildrenFromElement(this._host);
    const gridContents: MediaGridContents = new Map();
    for (const child of children) {
      const id = child.getAttribute(this._idAttribute) || String(gridContents.size);
      gridContents.set(id, child);
    }

    this._setGridContents(gridContents);
  };

  private _hasSameCells(gridContents: MediaGridContents): boolean {
    if (gridContents.size !== this._gridContents.size) {
      return false;
    }

    const existingCells = [...this._gridContents];
    return [...gridContents].every(
      ([id, element], index) =>
        existingCells[index][0] === id && existingCells[index][1] === element,
    );
  }

  private _setGridContents(gridContents: MediaGridContents): void {
    // Rebuilding Masonry resets the container height and clears every cell
    // position, so only do it when the cells themselves change.
    if (this._masonry && this._hasSameCells(gridContents)) {
      return;
    }

    this._gridContents = gridContents;

    if (this._selected !== null && !this._gridContents.has(this._selected)) {
      this.unselectAll();
    }

    for (const element of gridContents.values()) {
      this._removeChildEventListeners(element);
      this._addChildEventListeners(element);
    }

    // Size the cells before Masonry measures them.
    this._setCellSizeStyles();
    this._createMasonry();

    // Observe grid elements for size or id changes.
    this._cellMutationObserver.disconnect();
    this._cellResizeObserver.disconnect();
    for (const child of gridContents.values()) {
      this._cellMutationObserver.observe(child, {
        attributeFilter: [this._idAttribute, this._widthFactorAttribute],
        attributes: true,
      });
      this._cellResizeObserver.observe(child);
    }

    this._sortItemsInGrid();
    this._updateSelectedStylesOnElements();

    // A rebuilt grid has no cell positions at all, so lay it out immediately: a
    // throttled layout may be deferred, leaving the card collapsed until it
    // runs.
    this._forceLayout();
  }

  private _setCellSizeStyles(): void {
    this._setColumnSizeStyles();
    this._updateWidthFactorStyles();
  }

  // Apply a changed cell size to the existing grid. Masonry is updated in place
  // rather than recreated: a destroy resets the container height to 0, which
  // can cause an ancestor scrollbar to appear/disappear, changing the available
  // width and triggering an infinite resize oscillation.
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2306
  private _applyCellSize(): void {
    this._setCellSizeStyles();
    this._masonry?.option?.({ columnWidth: this._getColumnSize() });
    this._throttledLayout();
  }

  private _hostMutationHandler(): void {
    this._setGridContentsFromHost();
  }

  private _cellMutationHandler(mutations: MutationRecord[]): void {
    // A changed id changes which cell is which, so the grid must be rebuilt. A
    // changed width factor only changes how the cells are sized.
    if (mutations.some((mutation) => mutation.attributeName === this._idAttribute)) {
      this._setGridContentsFromHost();
    } else {
      this._applyCellSize();
    }
  }

  private _hostResizeHandler(): void {
    const dimensions = this._host.getBoundingClientRect();

    // Only resize things if the width has changed. It is expected that the
    // height may change during the layout.
    if (dimensions.width !== this._hostWidth) {
      this._hostWidth = dimensions.width;
      this._applyCellSize();
    }
  }

  private _cellResizeHandler(): void {
    this._throttledLayout();
  }

  private _addChildEventListeners(child: MediaGridChild): void {
    child.addEventListener('click', this._handleSelectGridCellEvent, {
      capture: true,
    });
  }

  private _removeChildEventListeners(child: MediaGridChild): void {
    child.removeEventListener('click', this._handleSelectGridCellEvent, {
      capture: true,
    });
  }

  private _createMasonry(): void {
    if (this._masonry) {
      this._masonry.destroy?.();
    }

    this._masonry = new Masonry(this._host, {
      columnWidth: this._getColumnSize(),
      initLayout: false,
      percentPosition: true,
      transitionDuration: 0,
      stagger: 0,

      // This controller handles resizes.
      resize: false,
      gutter: MEDIA_GRID_HORIZONTAL_GUTTER_WIDTH,
    }) as ExtendedMasonry;
    this._masonry.addItems?.([...this._gridContents.values()]);
  }

  private _handleSelectGridCellEvent = (ev: Event): void => {
    const eventPath = ev.composedPath();

    for (const [id, element] of this._gridContents.entries()) {
      if (eventPath.includes(element)) {
        if (this._selected !== id) {
          // Fire the request but do not mutate local state. The authoritative
          // selection lives upstream (ViewManager via the `selected` prop). On
          // acceptance, the new `selected` prop arrives and drives
          // `selectCell`. On rejection (e.g. navigation locked), the prop is
          // unchanged and the grid stays put.
          fireAdvancedCameraCardEvent(this._host, 'media-grid:selected', {
            selected: id,
          });
          ev.stopPropagation();
        }
        break;
      }
    }
  };

  private _updateSelectedStylesOnElements(): void {
    for (const [id, element] of this._gridContents.entries()) {
      element.toggleAttribute('selected', id === this._selected);

      // Explicitly use an 'unselected' attribute vs a :not(selected) such that
      // a carousel with neither selected nor unselected will behave normally.
      // This matches a css selector in viewer-carousel.scss .
      element.toggleAttribute('unselected', id !== this._selected);
    }
  }

  private _updateWidthFactorStyles(): void {
    for (const element of this._gridContents.values()) {
      const widthFactor = element.getAttribute(this._widthFactorAttribute);
      setOrRemoveStyleProperty(
        element,
        !!widthFactor,
        '--advanced-camera-card-grid-width-factor',
        widthFactor ?? undefined,
      );
    }
  }

  private _getColumnSize(): number {
    const columns = this._getColumns();
    if (columns === 1) {
      return this._hostWidth;
    }

    return Math.max(0, this._hostWidth / columns - MEDIA_GRID_HORIZONTAL_GUTTER_WIDTH);
  }

  private _getColumns(): number {
    if (this._displayConfig?.grid_columns) {
      return this._displayConfig?.grid_columns;
    }

    const maxColumns = this._displayConfig?.grid_max_columns ?? Infinity;

    // See if we can get a multi-column layout using the ideal cell width.
    const idealColumns = Math.min(
      maxColumns,
      Math.floor(this._hostWidth / MEDIA_GRID_DEFAULT_IDEAL_CELL_WIDTH),
    );
    if (idealColumns > 1) {
      return this._clampColumnsToDemand(idealColumns);
    }

    // If not, get a multi-column view using the minimum cell width.
    const minColumns = Math.floor(
      Math.min(maxColumns, this._hostWidth / MEDIA_GRID_DEFAULT_MIN_CELL_WIDTH),
    );

    // Last result use at least 1 column.
    return this._clampColumnsToDemand(Math.max(1, minColumns));
  }

  private _clampColumnsToDemand(columns: number): number {
    // Extra columns sit empty and make every item narrower than it needs to be.
    // At least 1 column is used, as the grid may be empty.
    return Math.max(1, Math.min(columns, this._getDemandedColumns()));
  }

  // The number of columns the grid items need: one or more per item, plus room
  // for any one of them to be selected.
  private _getDemandedColumns(): number {
    let demand = 0;
    let selectionAllowance = 0;

    for (const element of this._gridContents.values()) {
      const attribute = Number(element.getAttribute(this._widthFactorAttribute));

      // An absent or invalid attribute means the item is one column wide.
      const widthFactor = attribute > 0 ? attribute : 1;

      // Width factors may be fractional, but an item occupies whole columns:
      // two half-width items need two columns, not one.
      const columns = Math.ceil(widthFactor);
      demand += columns;

      selectionAllowance = Math.max(
        selectionAllowance,
        Math.ceil(widthFactor * this._getSelectedWidthFactor()) - columns,
      );
    }

    // The space a selection needs is reserved for any item, so that selecting
    // one does not change the column count and resize the whole grid. A lone
    // item cannot be wider than the grid, so it needs no reservation.
    return demand + (this._gridContents.size > 1 ? selectionAllowance : 0);
  }

  private _getSelectedWidthFactor(): number {
    return (
      this._displayConfig?.grid_selected_width_factor ??
      MEDIA_GRID_DEFAULT_SELECTED_WIDTH_FACTOR
    );
  }

  private _setColumnSizeStyles(): void {
    this._host.style.setProperty(
      '--advanced-camera-card-grid-column-size',
      `${this._getColumnSize()}px`,
    );

    this._host.style.setProperty(
      '--advanced-camera-card-grid-selected-width-factor',
      `${this._getSelectedWidthFactor()}`,
    );
  }
}
