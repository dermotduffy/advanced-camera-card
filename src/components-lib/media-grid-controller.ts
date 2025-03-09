import isEqual from 'lodash-es/isEqual';
import throttle from 'lodash-es/throttle';
import Masonry from 'masonry-layout';
import { ViewDisplayConfig } from '../config/types';
import { MediaLoadedInfo } from '../types';
import { getChildrenFromElement, setOrRemoveAttribute } from '../utils/basic';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event';
import {
  AdvancedCameraCardMediaLoadedEventTarget,
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaUnloadedEvent,
} from '../utils/media-info';

// The default minimum cell width: if the columns are not specified this value
// is used to compute the number of columns, always trying to keep each cell as
// at least this width. On Android, a card in portrait mode is 396 pixels, and
// we'd like to support two cells wide in that configuration.
const MEDIA_GRID_DEFAULT_MIN_CELL_WIDTH = 190;
const MEDIA_GRID_DEFAULT_IDEAL_CELL_WIDTH = 600;
const MEDIA_GRID_DEFAULT_SELECTED_WIDTH_FACTOR = 2.0;
const MEDIA_GRID_HORIZONTAL_GUTTER_WIDTH = 1;

type GridID = string;
type MediaGridChild = HTMLElement & AdvancedCameraCardMediaLoadedEventTarget;
type MediaGridContents = Map<GridID, MediaGridChild>;

export interface MediaGridSelected {
  selected: GridID;
}

export interface MediaGridConstructorOptions {
  selected?: GridID;
  idAttribute?: string;
  displayConfig?: ViewDisplayConfig;
}

export class MediaGridController {
  protected _host: HTMLElement;

  protected _selected: GridID | null;
  protected _mediaLoadedInfoMap: Map<GridID, MediaLoadedInfo> = new Map();
  protected _gridContents: MediaGridContents = new Map();
  protected _masonry: Masonry | null = null;
  protected _displayConfig: ViewDisplayConfig | null = null;
  protected _hostWidth: number;
  protected _idAttribute: string;

  protected _throttledLayout = throttle(
    () => this._masonry?.layout?.(),
    // Throttle layout calls to larger than the masonry.js transitionDuration
    // value specified below.
    300,
    { trailing: true, leading: false },
  );

  // If the order in which the observers are declared changes, the unittest must
  // be updated in triggerResizeObserver and triggerMutationObserver.
  protected _hostMutationObserver = new MutationObserver(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_mutations: MutationRecord[], _observer: MutationObserver) =>
      this._calculateGridContentsFromHost(),
  );
  protected _cellMutationObserver = new MutationObserver(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_mutations: MutationRecord[], _observer: MutationObserver) =>
      this._calculateGridContentsFromHost(),
  );
  protected _hostResizeObserver = new ResizeObserver(this._hostResizeHandler.bind(this));
  protected _cellResizeObserver = new ResizeObserver(this._cellResizeHandler.bind(this));

  constructor(host: HTMLElement, options?: MediaGridConstructorOptions) {
    this._host = host;
    this._selected = options?.selected ?? null;
    this._idAttribute = options?.idAttribute ?? 'grid-id';
    this._hostWidth = this._host.getBoundingClientRect().width;
    this._hostResizeObserver.observe(host);
    this._displayConfig = options?.displayConfig ?? null;

    this._hostMutationObserver.observe(host, {
      childList: true,
    });

    // Need to separately listen for slotchanges since mutation observer will
    // not be called for shadom DOM slotted changes.
    if (host instanceof HTMLSlotElement) {
      host.addEventListener('slotchange', this._calculateGridContentsFromHost);
    }
    this._calculateGridContentsFromHost();
  }

  public destroy(): void {
    this._hostResizeObserver.disconnect();
    this._cellResizeObserver.disconnect();

    this._hostMutationObserver.disconnect();
    this._cellMutationObserver.disconnect();

    if (this._host instanceof HTMLSlotElement) {
      this._host.removeEventListener('slotchange', this._calculateGridContentsFromHost);
    }

    this._mediaLoadedInfoMap.clear();
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
      this._calculateGridContentsFromHost();
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

  public selectCell(id: GridID) {
    if (this._selected === id) {
      return;
    }

    this._selected = id;
    fireAdvancedCameraCardEvent(this._host, 'media-grid:selected', { selected: id });

    const mediaLoadedInfo = this._mediaLoadedInfoMap.get(id);
    if (mediaLoadedInfo) {
      dispatchExistingMediaLoadedInfoAsEvent(this._host, mediaLoadedInfo);
    }

    this._updateSelectedStylesOnElements();

    // Sizes may change when an element is selected, so re-do the layout (must
    // come after the call to _updateStylesOnElements in order to ensure the
    // right styles are applied first).
    this._throttledLayout();
  }

  public unselectAll() {
    if (this._selected !== null) {
      dispatchMediaUnloadedEvent(this._host);
      fireAdvancedCameraCardEvent(this._host, 'media-grid:unselected');
    }
    this._selected = null;
    this._updateSelectedStylesOnElements();
  }

  protected _calculateGridContentsFromHost = (): void => {
    const children = getChildrenFromElement(this._host);
    const gridContents: MediaGridContents = new Map();
    for (const child of children) {
      const id = child.getAttribute(this._idAttribute) || String(gridContents.size);
      gridContents.set(id, child);
    }

    this._setGridContents(gridContents);
  };

  protected _setGridContents(gridContents: MediaGridContents): void {
    this._gridContents = gridContents;

    // Remove media loaded info objects that belong to objects no longer in the
    // grid.
    for (const key of this._mediaLoadedInfoMap.keys()) {
      if (!gridContents.has(key)) {
        this._mediaLoadedInfoMap.delete(key);
      }
    }

    if (this._selected !== null && !this._gridContents.has(this._selected)) {
      this.unselectAll();
    }

    for (const element of gridContents.values()) {
      this._removeChildEventListeners(element);
      this._addChildEventListeners(element);
    }

    this._setColumnSizeStyles();
    this._createMasonry();

    // Observe grid elements for size or id changes.
    this._cellMutationObserver.disconnect();
    this._cellResizeObserver.disconnect();
    for (const child of gridContents.values()) {
      this._cellMutationObserver.observe(child, {
        attributeFilter: [this._idAttribute],
        attributes: true,
      });
      this._cellResizeObserver.observe(child);
    }

    this._updateSelectedStylesOnElements();
    this._setColumnSizeStyles();
  }

  protected _handleMediaLoadedInfoEvent = (ev: CustomEvent<MediaLoadedInfo>): void => {
    const eventPath = ev.composedPath();

    for (const [id, element] of this._gridContents.entries()) {
      /* istanbul ignore else: the else path cannot be reached -- @preserve */
      if (eventPath.includes(element)) {
        this._mediaLoadedInfoMap.set(id, ev.detail);
        if (id !== this._selected) {
          ev.stopPropagation();
        }
        break;
      }
    }
  };

  protected _hostResizeHandler(): void {
    const dimensions = this._host.getBoundingClientRect();

    // Only resize things if the width has changed. It is expected that the
    // height may change during the layout.
    if (dimensions.width !== this._hostWidth) {
      this._hostWidth = dimensions.width;

      // Reset the column CSS sizes first.
      this._setColumnSizeStyles();

      // Need to recreate the masonry layout since the column width will differ.
      this._createMasonry();
    }
  }

  protected _cellResizeHandler(): void {
    this._throttledLayout();
  }

  protected _addChildEventListeners(child: MediaGridChild): void {
    child.addEventListener('click', this._handleSelectGridCellEvent, {
      capture: true,
    });

    child.addEventListener(
      'advanced-camera-card:media:loaded',
      this._handleMediaLoadedInfoEvent,
    );
  }

  protected _removeChildEventListeners(child: MediaGridChild): void {
    child.removeEventListener('click', this._handleSelectGridCellEvent, {
      capture: true,
    });

    child.removeEventListener(
      'advanced-camera-card:media:loaded',
      this._handleMediaLoadedInfoEvent,
    );
  }

  protected _createMasonry(): void {
    if (this._masonry) {
      this._masonry.destroy?.();
    }

    this._masonry = new Masonry(this._host, {
      columnWidth: this._getColumnSize(),
      initLayout: false,
      percentPosition: true,
      transitionDuration: '0.2s',
      gutter: MEDIA_GRID_HORIZONTAL_GUTTER_WIDTH,
    });
    this._masonry.addItems?.([...this._gridContents.values()]);
    this._throttledLayout();
  }

  protected _handleSelectGridCellEvent = (ev: Event): void => {
    const eventPath = ev.composedPath();

    for (const [id, element] of this._gridContents.entries()) {
      /* istanbul ignore else: the else path cannot be reached -- @preserve */
      if (eventPath.includes(element)) {
        if (this._selected !== id) {
          this.selectCell(id);
          ev.stopPropagation();
        }
        break;
      }
    }
  };

  protected _updateSelectedStylesOnElements(): void {
    for (const [id, element] of this._gridContents.entries()) {
      setOrRemoveAttribute(element, id === this._selected, 'selected');

      // Explicitly use an 'unselected' attribute vs a :not(selected) such that
      // a carousel with neither selected nor unselected will behave normally.
      // This matches a css selector in viewer-carousel.scss .
      setOrRemoveAttribute(element, id !== this._selected, 'unselected');
    }
  }

  protected _getColumnSize(): number {
    const columns = this._getColumns();
    if (columns === 1) {
      return this._hostWidth;
    }

    return Math.max(0, this._hostWidth / columns - MEDIA_GRID_HORIZONTAL_GUTTER_WIDTH);
  }

  protected _getColumns(): number {
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
      return idealColumns;
    }

    // If not, get a multi-column view using the minimum cell width.
    const minColumns = Math.floor(
      Math.min(maxColumns, this._hostWidth / MEDIA_GRID_DEFAULT_MIN_CELL_WIDTH),
    );

    // Last result use at least 1 column.
    return Math.max(1, minColumns);
  }

  protected _setColumnSizeStyles(): void {
    this._host.style.setProperty(
      '--advanced-camera-card-grid-column-size',
      `${this._getColumnSize()}px`,
    );

    this._host.style.setProperty(
      '--advanced-camera-card-grid-selected-width-factor',
      `${
        this._displayConfig?.grid_selected_width_factor ??
        MEDIA_GRID_DEFAULT_SELECTED_WIDTH_FACTOR
      }`,
    );
  }
}
