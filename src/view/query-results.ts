import { isSuperset } from '../utils/basic.js';
import { ViewItemClassifier } from './item-classifier.js';
import { ViewItem } from './item.js';

type CameraResultSlices = Map<string, ResultSlice>;
type SelectApproach = 'first' | 'last';

interface ResultSliceOptions {
  results?: ViewItem[];
  selectedIndex?: number | null;
  selectApproach?: SelectApproach;
}

class ResultSlice {
  protected _results: ViewItem[];
  protected _selectedIndex: number | null;

  constructor(options?: ResultSliceOptions) {
    this._results = options?.results ?? [];
    this._selectedIndex = this._getInitialSelectedIndex(options);
  }

  protected _getInitialSelectedIndex(options?: ResultSliceOptions): number | null {
    if (options?.selectedIndex !== undefined && options?.selectedIndex !== null) {
      return options.selectedIndex;
    }
    if (options?.results && options.results.length) {
      if (!options?.selectApproach || options?.selectApproach === 'last') {
        return options.results.length - 1;
      } else {
        return 0;
      }
    }
    return null;
  }

  public clone(): ResultSlice {
    return new ResultSlice({
      results: this._results,
      selectedIndex: this._selectedIndex,
    });
  }

  public getResults(): ViewItem[] {
    return this._results;
  }
  public getSelectedIndex(): number | null {
    return this._selectedIndex;
  }
  public getResultsCount(): number {
    return this.getResults().length;
  }
  public hasResults(): boolean {
    return this.getResultsCount() !== 0;
  }
  public getResult(index?: number): ViewItem | null {
    return index === undefined ? null : this._results[index];
  }
  public getSelectedResult(): ViewItem | null {
    const index = this.getSelectedIndex();
    return index !== null ? this.getResult(index) : null;
  }
  public hasSelectedResult(): boolean {
    return this.getSelectedResult() !== null;
  }
  public resetSelectedResult(): void {
    this._selectedIndex = null;
  }

  public selectIndex(index: number | null): void {
    if (index === null || (index >= 0 && index < this._results.length)) {
      this._selectedIndex = index;
    }
  }
  public selectResultIfFound(func: (item: ViewItem) => boolean): void {
    for (const [index, result] of this._results.entries()) {
      if (func(result)) {
        this.selectIndex(index);
        break;
      }
    }
  }
  public selectBestResult(func: (item: ViewItem[]) => number | null): void {
    const resultIndex = func(this._results);
    if (resultIndex !== null) {
      this.selectIndex(resultIndex);
    }
  }

  /**
   * Remove an item from this slice, preserving selection where possible.
   * If the selected item is removed, selects the previous item.
   * @param item The item to remove.
   * @returns true if the item was found and removed, false otherwise.
   */
  public removeItem(item: ViewItem): boolean {
    const index = this._results.indexOf(item);
    if (index === -1) {
      return false;
    }

    // Copy-on-write: Create a new array reference only when modifying
    this._results = [...this._results];
    this._results.splice(index, 1);

    // Adjust selection: if removed was selected, clamp to valid range; if after, decrement
    if (this._selectedIndex !== null && this._selectedIndex >= index) {
      if (this._selectedIndex === index) {
        // Removed the selected item: clamp to new valid range or null if empty
        this._selectedIndex =
          this._results.length > 0 ? Math.min(index, this._results.length - 1) : null;
      } else {
        // Removed an item before the selected one: decrement
        this._selectedIndex = this._selectedIndex - 1;
      }
    }
    return true;
  }
}

interface ResultSliceSelectionCriteria {
  main?: boolean;
  cameraID?: string;
  allCameras?: boolean;
}

export class QueryResults {
  protected _resultsTimestamp: Date | null = null;
  protected _main: ResultSlice;
  protected _cameras: CameraResultSlices = new Map();

  constructor(options?: ResultSliceOptions) {
    this._resultsTimestamp = new Date();
    this._main = new ResultSlice(options);
    this._buildByCameraSlices(options?.selectApproach);
  }

  protected _buildByCameraSlices(selectApproach?: SelectApproach): void {
    const cameraMap: Map<string, ViewItem[]> = new Map();
    for (const result of this._main.getResults()) {
      const cameraID = ViewItemClassifier.isMedia(result) ? result.getCameraID() : null;
      if (cameraID) {
        const items: ViewItem[] = cameraMap.get(cameraID) ?? [];
        items.push(result);
        cameraMap.set(cameraID, items);
      }
    }

    for (const [cameraID, items] of cameraMap.entries()) {
      this._cameras.set(
        cameraID,
        new ResultSlice({
          results: items,
          selectApproach: selectApproach,
        }),
      );
    }
  }

  public clone(): QueryResults {
    // Shallow clone -- will reuse the same results object (as there are no
    // methods that support modification of the results themselves, and since
    // changing the index on a consistent set of results is a very common
    // operation).
    const copy = new QueryResults();
    copy._resultsTimestamp = this._resultsTimestamp;
    copy._main = this._main.clone();

    for (const [cameraID, slice] of this._cameras.entries()) {
      copy._cameras.set(cameraID, slice.clone());
    }
    return copy;
  }

  /**
   * Remove a specific item from the results.
   * Note: This mutates the current instance. Use clone() first if needed.
   * @param item The item to remove from results.
   * @returns This QueryResults instance for chaining.
   */
  public removeItem(item: ViewItem): QueryResults {
    if (!this._main.removeItem(item)) {
      return this;
    }

    // Also remove from the relevant camera slice
    const cameraID = ViewItemClassifier.isMedia(item) ? item.getCameraID() : null;
    if (cameraID) {
      this._cameras.get(cameraID)?.removeItem(item);
    }
    return this;
  }

  public isSupersetOf(that: QueryResults): boolean {
    const thisItemIDs = new Set(this._main.getResults()?.map((item) => item.getID()));
    const thatItemIDs = new Set(that._main.getResults()?.map((item) => item.getID()));

    if (
      !thisItemIDs.size ||
      !thatItemIDs.size ||
      // If either item sets contain a null identifier (i.e. an item item with
      // no ID) we must assume this is not a subset as multiple items may reduce
      // to the same null identifier above.
      thisItemIDs.has(null) ||
      thatItemIDs.has(null)
    ) {
      return false;
    }
    return isSuperset(thisItemIDs, thatItemIDs);
  }

  public getCameraIDs(): Set<string> {
    return new Set(this._cameras.keys());
  }

  public getSlice(cameraID?: string): ResultSlice | null {
    return cameraID ? this._cameras.get(cameraID) ?? null : this._main;
  }

  public getResults(cameraID?: string): ViewItem[] | null {
    return this.getSlice(cameraID)?.getResults() ?? null;
  }
  public getResultsCount(cameraID?: string): number {
    return this.getSlice(cameraID)?.getResultsCount() ?? 0;
  }
  public hasResults(cameraID?: string): boolean {
    return this.getSlice(cameraID)?.getResultsCount() !== 0;
  }
  public getResult(index?: number, cameraID?: string): ViewItem | null {
    return this.getSlice(cameraID)?.getResult(index) ?? null;
  }
  public getSelectedIndex(cameraID?: string): number | null {
    return this.getSlice(cameraID)?.getSelectedIndex() ?? null;
  }
  public getSelectedResult(cameraID?: string): ViewItem | null {
    return this.getSlice(cameraID)?.getSelectedResult() ?? null;
  }
  public getMultipleSelectedResults(
    criteria?: ResultSliceSelectionCriteria,
  ): ViewItem[] {
    const results: ViewItem[] = [];
    if (!criteria || criteria.main) {
      const mainResult = this.getSelectedResult();
      if (mainResult) {
        results.push(mainResult);
      }
    }
    const cameraIDs = this._getCameraIDsFromCriteria(criteria);
    for (const cameraID of cameraIDs ?? []) {
      const result = this.getSelectedResult(cameraID);
      if (result) {
        results.push(result);
      }
    }
    return results;
  }
  public hasSelectedResult(cameraID?: string): boolean {
    return this.getSlice(cameraID)?.hasSelectedResult() ?? false;
  }
  public resetSelectedResult(cameraID?: string): QueryResults {
    this.getSlice(cameraID)?.resetSelectedResult();
    return this;
  }
  public getResultsTimestamp(): Date | null {
    return this._resultsTimestamp;
  }

  public selectIndex(index: number, cameraID?: string): QueryResults {
    this.getSlice(cameraID)?.selectIndex(index);
    if (!cameraID) {
      // If the main selection is changed, it must also change the matching
      // camera selection.
      this.demoteMainSelectionToCameraSelection();
    }
    return this;
  }

  public demoteMainSelectionToCameraSelection(): QueryResults {
    const selected = this.getSelectedResult();
    const cameraID = ViewItemClassifier.isMedia(selected)
      ? selected?.getCameraID()
      : null;

    if (selected && cameraID) {
      this.resetSelectedResult(cameraID);
      this.selectResultIfFound((item) => item === selected, { cameraID: cameraID });
    }
    return this;
  }

  public promoteCameraSelectionToMainSelection(cameraID: string): QueryResults {
    const selected = this.getSelectedResult(cameraID);
    this.resetSelectedResult();
    this.selectResultIfFound((item) => item === selected);
    return this;
  }

  protected _getCameraIDsFromCriteria(
    criteria?: ResultSliceSelectionCriteria,
  ): Set<string> | null {
    return criteria?.allCameras
      ? this.getCameraIDs()
      : criteria?.cameraID
        ? new Set([criteria.cameraID])
        : null;
  }

  public selectResultIfFound(
    func: (item: ViewItem) => boolean,
    criteria?: ResultSliceSelectionCriteria,
  ): QueryResults {
    if (!criteria || criteria?.main) {
      this._main.selectResultIfFound(func);
      this.demoteMainSelectionToCameraSelection();
    }
    const cameraIDs = this._getCameraIDsFromCriteria(criteria);
    for (const cameraID of cameraIDs ?? []) {
      this.getSlice(cameraID)?.selectResultIfFound(func);
    }
    return this;
  }
  public selectBestResult(
    func: (item: ViewItem[]) => number | null,
    criteria?: ResultSliceSelectionCriteria,
  ): QueryResults {
    if (!criteria || criteria.main) {
      this._main.selectBestResult(func);
      this.demoteMainSelectionToCameraSelection();
    }
    const cameraIDs = this._getCameraIDsFromCriteria(criteria);
    for (const cameraID of cameraIDs ?? []) {
      this.getSlice(cameraID)?.selectBestResult(func);
    }
    return this;
  }
}
