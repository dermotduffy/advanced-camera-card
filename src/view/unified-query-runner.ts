import { CameraManager } from '../camera-manager/manager';
import { FoldersManager } from '../card-controller/folders/manager';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types';
import { ViewItem } from '../view/item';
import { UnifiedQuery } from '../view/unified-query';

export interface QueryRunnerOptions {
  useCache?: boolean;
}

/**
 * UnifiedQueryRunner routes UnifiedQuery nodes to the appropriate managers.
 */
export class UnifiedQueryRunner {
  private _cameraManager: CameraManager;
  private _foldersManager: FoldersManager;
  private _conditionStateManager: ConditionStateManagerReadonlyInterface;

  constructor(
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    conditionStateManager: ConditionStateManagerReadonlyInterface,
  ) {
    this._cameraManager = cameraManager;
    this._foldersManager = foldersManager;
    this._conditionStateManager = conditionStateManager;
  }

  public async execute(
    query: UnifiedQuery,
    options?: QueryRunnerOptions,
  ): Promise<ViewItem[]> {
    const allItems: ViewItem[] = [];

    // Execute media queries
    const mediaQueries = query.getMediaQueries();
    if (mediaQueries.length > 0) {
      const items = await this._cameraManager.executeMediaQueries(mediaQueries, {
        useCache: options?.useCache,
      });
      allItems.push(...(items ?? []));
    }

    // Execute folder queries
    const folderQueries = query.getFolderQueries();
    for (const folderQuery of folderQueries) {
      const items = await this._foldersManager.expandFolder(
        folderQuery,
        this._conditionStateManager.getState(),
        { useCache: options?.useCache },
      );
      allItems.push(...(items ?? []));
    }

    return allItems;
  }

  public areResultsFresh(resultsTimestamp: Date, query: UnifiedQuery): boolean {
    const mediaQueries = query.getMediaQueries();
    if (
      mediaQueries.length > 0 &&
      !this._cameraManager.areMediaQueriesResultsFresh(resultsTimestamp, mediaQueries)
    ) {
      return false;
    }

    const folderQueries = query.getFolderQueries();
    for (const folderQuery of folderQueries) {
      if (!this._foldersManager.areResultsFresh(resultsTimestamp, folderQuery)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extend a query by fetching additional media in a direction (earlier/later).
   */
  public async extend(
    query: UnifiedQuery,
    existingResults: ViewItem[],
    direction: 'earlier' | 'later',
    options?: QueryRunnerOptions,
  ): Promise<{ query: UnifiedQuery; results: ViewItem[] } | null> {
    const mediaQueries = query.getMediaQueries();
    const nonExtendableQueries = query.getNonMediaQueries();

    if (mediaQueries.length === 0) {
      return null;
    }

    const extension = await this._cameraManager.extendMediaQueries(
      mediaQueries,
      existingResults,
      direction,
      { useCache: options?.useCache },
    );

    if (!extension) {
      return null;
    }

    const extendedQuery = new UnifiedQuery();
    for (const mediaQuery of extension.queries) {
      extendedQuery.addNode(mediaQuery);
    }
    for (const node of nonExtendableQueries) {
      extendedQuery.addNode(node);
    }

    return { query: extendedQuery, results: extension.results };
  }
}
