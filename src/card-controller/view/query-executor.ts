import { CapabilitySearchOptions, MediaQuery } from '../../camera-manager/types';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../../const';
import { ClipsOrSnapshotsOrAll } from '../../types';
import { findBestMediaTimeIndex } from '../../utils/find-best-media-time-index';
import { ViewItem } from '../../view/item';
import {
  EventMediaQuery,
  FolderViewQuery,
  MediaQueries,
  Query,
  RecordingMediaQuery,
} from '../../view/query';
import { QueryClassifier } from '../../view/query-classifier';
import { QueryResults } from '../../view/query-results';
import { CardViewAPI } from '../types';
import { QueryExecutorOptions, QueryExecutorResult } from './types';

export class QueryExecutor {
  protected _api: CardViewAPI;

  constructor(api: CardViewAPI) {
    this._api = api;
  }

  public async executeDefaultEventQuery(options?: {
    cameraID?: string;
    eventsMediaType?: ClipsOrSnapshotsOrAll;
    executorOptions?: QueryExecutorOptions;
  }): Promise<QueryExecutorResult | null> {
    const capabilitySearch: CapabilitySearchOptions =
      !options?.eventsMediaType || options?.eventsMediaType === 'all'
        ? {
            anyCapabilities: ['clips', 'snapshots'],
          }
        : options.eventsMediaType;

    const cameraManager = this._api.getCameraManager();
    const cameraIDs = options?.cameraID
      ? cameraManager
          .getStore()
          .getAllDependentCameras(options.cameraID, capabilitySearch)
      : cameraManager.getStore().getCameraIDsWithCapability(capabilitySearch);
    if (!cameraIDs.size) {
      return null;
    }

    const rawQueries = cameraManager.generateDefaultEventQueries(cameraIDs, {
      limit: this._getChunkLimit(),
      ...(options?.eventsMediaType === 'clips' && { hasClip: true }),
      ...(options?.eventsMediaType === 'snapshots' && { hasSnapshot: true }),
    });
    if (!rawQueries) {
      return null;
    }
    const queries = new EventMediaQuery(rawQueries);
    return await this.executeMediaQuery(queries, options?.executorOptions);
  }

  public async executeDefaultRecordingQuery(options?: {
    cameraID?: string;
    executorOptions?: QueryExecutorOptions;
  }): Promise<QueryExecutorResult | null> {
    const cameraManager = this._api.getCameraManager();
    const cameraIDs = options?.cameraID
      ? cameraManager.getStore().getAllDependentCameras(options.cameraID, 'recordings')
      : cameraManager.getStore().getCameraIDsWithCapability('recordings');
    if (!cameraIDs.size) {
      return null;
    }

    const rawQueries = cameraManager.generateDefaultRecordingQueries(cameraIDs, {
      limit: this._getChunkLimit(),
    });
    if (!rawQueries) {
      return null;
    }
    const queries = new RecordingMediaQuery(rawQueries);
    return await this.executeMediaQuery(queries, options?.executorOptions);
  }

  public async executeQuery(
    query: Query,
    executorOptions?: QueryExecutorOptions,
  ): Promise<QueryExecutorResult | null> {
    /* istanbul ignore else: this path cannot be reached -- @preserve */
    if (QueryClassifier.isMediaQuery(query)) {
      return await this.executeMediaQuery(query, executorOptions);
    } else if (QueryClassifier.isFolderQuery(query)) {
      return await this._executeFolderQuery(query, executorOptions);
    }

    /* istanbul ignore next: this path cannot be reached -- @preserve */
    return null;
  }

  public async executeMediaQuery(
    query: MediaQueries,
    executorOptions?: QueryExecutorOptions,
  ): Promise<QueryExecutorResult | null> {
    const queries = query.getQuery();
    if (!queries) {
      return null;
    }

    const mediaArray = await this._api
      .getCameraManager()
      .executeMediaQueries<MediaQuery>(queries, {
        useCache: executorOptions?.useCache,
      });
    const queryResults = mediaArray
      ? this._generateQueriesResults(mediaArray, executorOptions)
      : null;
    return queryResults ? { query, queryResults } : null;
  }

  private _generateQueriesResults(
    itemArray: ViewItem[],
    executorOptions?: QueryExecutorOptions,
  ): QueryResults | null {
    const queryResults = new QueryResults({ results: itemArray });
    if (executorOptions?.rejectResults?.(queryResults)) {
      return null;
    }

    if (executorOptions?.selectResult?.id) {
      queryResults.selectBestResult((media) =>
        media.findIndex((m) => m.getID() === executorOptions.selectResult?.id),
      );
    } else if (executorOptions?.selectResult?.func) {
      queryResults.selectResultIfFound(executorOptions.selectResult.func);
    } else if (executorOptions?.selectResult?.time) {
      queryResults.selectBestResult((itemArray) =>
        findBestMediaTimeIndex(
          itemArray,
          executorOptions.selectResult?.time?.time as Date,
          executorOptions.selectResult?.time?.favorCameraID,
        ),
      );
    }
    return queryResults;
  }

  public async executeDefaultFolderQuery(
    executorOptions?: QueryExecutorOptions,
  ): Promise<QueryExecutorResult | null> {
    const defaultFolder = this._api.getFoldersManager().getFolder();
    return defaultFolder
      ? this._executeFolderQuery(
          new FolderViewQuery({ folder: defaultFolder }),
          executorOptions,
        )
      : null;
  }

  private async _executeFolderQuery(
    query: FolderViewQuery,
    executorOptions?: QueryExecutorOptions,
  ): Promise<QueryExecutorResult | null> {
    const rawQuery = query.getQuery();
    if (!rawQuery) {
      return null;
    }
    const itemArray = await this._api
      .getFoldersManager()
      .expandFolder(rawQuery, { useCache: executorOptions?.useCache });

    const queryResults = itemArray
      ? this._generateQueriesResults(itemArray, executorOptions)
      : null;
    return queryResults ? { query, queryResults } : null;
  }

  protected _getChunkLimit(): number {
    const cardWideConfig = this._api.getConfigManager().getCardWideConfig();
    return (
      cardWideConfig?.performance?.features.media_chunk_size ?? MEDIA_CHUNK_SIZE_DEFAULT
    );
  }
}
