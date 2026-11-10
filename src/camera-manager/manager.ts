import { add } from 'date-fns';
import { cloneDeep, omit, sum } from 'lodash-es';
import PQueue from 'p-queue';

import { EqualityMap } from '../cache/equality-map.js';
import type { CardCameraAPI } from '../card-controller/types.js';
import { sortItems } from '../card-controller/view/sort.js';
import type {
  PTZAction,
  PTZActionPhase,
  PTZPanTiltAction,
} from '../config/schema/actions/custom/ptz.js';
import type { CameraConfig, Rotation } from '../config/schema/cameras.js';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const.js';
import type { Endpoint } from '../types.js';
import {
  allPromises,
  arrayify,
  errorToConsole,
  isTruthy,
  recursivelyMergeObjectsNotArrays,
  setify,
} from '../utils/basic.js';
import { getCameraID } from '../utils/camera.js';
import { Generation } from '../utils/concurrency/generation.js';
import { log } from '../utils/debug.js';
import { ViewItemClassifier } from '../view/item-classifier.js';
import type { ViewItem, ViewMedia } from '../view/item.js';
import type { ViewItemCapabilities } from '../view/types.js';
import type { Camera } from './camera.js';
import { Capabilities } from './capabilities.js';
import { CameraManagerEngineFactory } from './engine-factory.js';
import type { CameraManagerEngine } from './engine.js';
import {
  CameraDuplicateIDError,
  CameraNoEngineError,
  CameraNoIDError,
} from './error.js';
import { CameraManagerStore, type CameraManagerReadOnlyConfigStore } from './store.js';
import {
  QueryResultsType,
  QueryType,
  type CameraEndpoints,
  type CameraEndpointsContext,
  type CameraManagerCameraMetadata,
  type CameraQuery,
  type DefaultQueryParameters,
  type Engine,
  type EngineOptions,
  type EventQuery,
  type EventQueryResults,
  type EventQueryResultsMap,
  type MediaMetadata,
  type MediaMetadataQuery,
  type MediaMetadataQueryResults,
  type MediaQuery,
  type PartialCameraQuery,
  type PartialEventQuery,
  type PartialQueryConcreteType,
  type PartialRecordingQuery,
  type PartialRecordingSegmentsQuery,
  type PartialReviewQuery,
  type QueryResults,
  type QueryReturnType,
  type RecordingQuery,
  type RecordingQueryResults,
  type RecordingQueryResultsMap,
  type RecordingSegmentsQuery,
  type RecordingSegmentsQueryResults,
  type RecordingSegmentsQueryResultsMap,
  type ResultsMap,
  type ReviewQuery,
  type ReviewQueryResults,
} from './types.js';

export class CameraQueryClassifier {
  public static isEventQuery(
    query: CameraQuery | PartialCameraQuery,
  ): query is EventQuery {
    return query.type === QueryType.Event;
  }
  public static isRecordingQuery(
    query: CameraQuery | PartialCameraQuery,
  ): query is RecordingQuery {
    return query.type === QueryType.Recording;
  }
  public static isRecordingSegmentsQuery(
    query: CameraQuery | PartialCameraQuery,
  ): query is RecordingSegmentsQuery {
    return query.type === QueryType.RecordingSegments;
  }
  public static isMediaMetadataQuery(
    query: CameraQuery | PartialCameraQuery,
  ): query is MediaMetadataQuery {
    return query.type === QueryType.MediaMetadata;
  }
  public static isReviewQuery(
    query: CameraQuery | PartialCameraQuery,
  ): query is ReviewQuery {
    return query.type === QueryType.Review;
  }
}

export class QueryResultClassifier {
  public static isEventQueryResult(
    queryResults?: QueryResults | null,
  ): queryResults is EventQueryResults {
    return queryResults?.type === QueryResultsType.Event;
  }
  public static isRecordingQueryResult(
    queryResults?: QueryResults | null,
  ): queryResults is RecordingQueryResults {
    return queryResults?.type === QueryResultsType.Recording;
  }
  public static isRecordingSegmentsQueryResult(
    queryResults?: QueryResults | null,
  ): queryResults is RecordingSegmentsQueryResults {
    return queryResults?.type === QueryResultsType.RecordingSegments;
  }
  public static isMediaMetadataQueryResult(
    queryResults?: QueryResults | null,
  ): queryResults is MediaMetadataQueryResults {
    return queryResults?.type === QueryResultsType.MediaMetadata;
  }
  public static isReviewQueryResult(
    queryResults?: QueryResults | null,
  ): queryResults is ReviewQueryResults {
    return queryResults?.type === QueryResultsType.Review;
  }
}

interface ExtendedMediaQueryResult<T extends MediaQuery> {
  queries: T[];
  results: ViewItem[];
}

export class CameraManager {
  private _api: CardCameraAPI;
  private _engineFactory: CameraManagerEngineFactory;
  private _store: CameraManagerStore;
  private _requestLimit = new PQueue();

  // Cameras take time to build, so a teardown or a newer initialization can
  // arrive mid-build and leave the finished cameras with no owner.
  private _generation = new Generation();

  // Handing cameras to the store is not atomic, so commits and teardowns run
  // one at a time and cannot observe each other half-applied.
  private _storeCommits = new PQueue({ concurrency: 1 });

  constructor(
    api: CardCameraAPI,
    options?: {
      store?: CameraManagerStore;
      factory?: CameraManagerEngineFactory;
    },
  ) {
    this._api = api;
    this._engineFactory =
      options?.factory ??
      new CameraManagerEngineFactory(
        this._api.getEntityRegistryManager(),
        this._api.getDeviceRegistryManager(),
      );
    this._store = options?.store ?? new CameraManagerStore();
  }

  public async initializeCamerasFromConfig(): Promise<void> {
    // Taken before the early return below: a call that cannot proceed still
    // supersedes an older one whose cameras are being built from a
    // configuration that no longer applies.
    const generation = this._generation.next();

    const config = this._api.getConfigManager().getConfig();
    const hass = this._api.getHASSManager().getHASS();

    if (!config || !hass) {
      return;
    }

    this._requestLimit.concurrency =
      config.performance.features.max_simultaneous_engine_requests ?? Infinity;

    // For each camera merge the config (which has no defaults) into the camera
    // global config (which does have defaults). The merging must happen in this
    // order, to ensure that the defaults in the cameras global config do not
    // override the values specified in the per-camera config.
    const cameras = (config.cameras ?? []).map((camera) =>
      recursivelyMergeObjectsNotArrays(config?.cameras_global, camera),
    );

    await this._initializeCameras(cameras, generation);
  }

  public async destroy(): Promise<void> {
    this._generation.invalidate();
    await this._storeCommits.add(() => this._store.reset());
  }

  private async _getEnginesForCameras(
    camerasConfig: CameraConfig[],
  ): Promise<Map<CameraConfig, CameraManagerEngine>> {
    const output: Map<CameraConfig, CameraManagerEngine> = new Map();
    const engines: Map<Engine, CameraManagerEngine> = new Map();
    const hass = this._api.getHASSManager().getHASS();

    /* v8 ignore if: the if path cannot be reached -- @preserve */
    if (!hass) {
      return output;
    }

    const getEngineTypes = async (configs: CameraConfig[]) => {
      return await allPromises(configs, (config) =>
        this._engineFactory.getEngineForCamera(hass, config),
      );
    };

    const engineTypes = await getEngineTypes(camerasConfig);
    for (const [index, cameraConfig] of camerasConfig.entries()) {
      const engineType = engineTypes[index];
      const engine = engineType
        ? engines.get(engineType) ??
          (await this._engineFactory.createEngine(engineType, {
            eventCallback: (ev) =>
              this._api.getCameraTriggersManager().handleCameraEvent(ev),
            hassManager: this._api.getHASSManager(),
            resolvedMediaCache: this._api.getResolvedMediaCache(),
          }))
        : null;
      if (!engine || !engineType) {
        // Camera initialization may modify the configuration. Keep the
        // original config unchanged.
        throw new CameraNoEngineError(cloneDeep(cameraConfig));
      }
      engines.set(engineType, engine);
      output.set(cameraConfig, engine);
    }
    return output;
  }

  /**
   * Create a camera for each engine, and assign each its ID. An initialized
   * camera holds live subscriptions, so either every camera is returned ready
   * for the store to own, or none survive: any failure destroys all of them
   * before throwing.
   */
  private async _createCameras(
    engineByConfig: Map<CameraConfig, CameraManagerEngine>,
  ): Promise<Camera[]> {
    // A camera that fails is taken out of the results rather than abandoning
    // the others mid-flight, which would leave an initialized camera with
    // nobody holding a reference to it.
    const failures: unknown[] = [];
    const cameras = (
      await allPromises(engineByConfig, ([cameraConfig, engine]) =>
        engine.createCamera(cameraConfig).catch((error: unknown) => {
          failures.push(error);
          return null;
        }),
      )
    ).filter(isTruthy);

    try {
      if (failures.length) {
        throw failures[0];
      }

      const cameraIDs: Set<string> = new Set();

      // Do the additions based off the result-order, to ensure the map order is
      // preserved.
      for (const camera of cameras) {
        const cameraID = getCameraID(camera.getConfig());

        if (!cameraID) {
          throw new CameraNoIDError(camera.getConfig());
        }

        if (cameraIDs.has(cameraID)) {
          throw new CameraDuplicateIDError(camera.getConfig());
        }

        // Always ensure the actual ID used in the card is in the configuration itself.
        camera.setID(cameraID);
        cameraIDs.add(cameraID);
      }
    } catch (e) {
      await this._destroyCameras(cameras);
      throw e;
    }

    return cameras;
  }

  private async _destroyCameras(cameras: Camera[]): Promise<void> {
    await allPromises(cameras, async (camera) => {
      try {
        await camera.destroy();
      } catch (error: unknown) {
        errorToConsole(error);
      }
    });
  }

  private async _initializeCameras(
    camerasConfig: CameraConfig[],
    generation: number,
  ): Promise<void> {
    const initializationStartTime = new Date();
    const hass = this._api.getHASSManager().getHASS();

    /* v8 ignore if: the if path cannot be reached -- @preserve */
    if (!hass) {
      return;
    }

    const requiresAutoTriggerDetection = camerasConfig.some(
      ({ triggers }) => triggers.motion || triggers.occupancy || triggers.doorbell,
    );

    if (requiresAutoTriggerDetection) {
      // Populate the entity cache by fetching all entities from Home Assistant
      // once upfront, to avoid each camera needing to fetch entity state.
      await this._api.getEntityRegistryManager().fetchEntityList(hass);
    }

    // Engines are created sequentially, to avoid duplicate creation of the same
    // engine. See: https://github.com/dermotduffy/advanced-camera-card/issues/941
    const engineByConfig = await this._getEnginesForCameras(camerasConfig);

    const cameras = await this._createCameras(engineByConfig);

    // The store mutates incrementally, so staleness is re-checked inside the
    // queue rather than before it: a teardown or a later initialization that
    // arrives mid-commit would otherwise interleave with this one.
    await this._storeCommits.add(async () => {
      // Nothing will ever own these cameras, so they are destroyed instead of
      // being handed to a store that has moved on.
      if (!this._generation.isCurrent(generation)) {
        await this._destroyCameras(cameras);
        return;
      }

      await this._store.setCameras(cameras);
    });

    log(
      this._api.getConfigManager().getCardWideConfig(),
      'Advanced Camera Card CameraManager initialized (Cameras: ',
      this._store.getCameras(),
      `, Duration: ${
        (new Date().getTime() - initializationStartTime.getTime()) / 1000
      }s,`,
      ')',
    );
  }

  public isInitialized(): boolean {
    return this._store.getCameraCount() > 0;
  }

  public getStore(): CameraManagerReadOnlyConfigStore {
    return this._store;
  }

  public generateDefaultEventQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialEventQuery,
  ): EventQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.Event,
      ...partialQuery,
    });
  }

  public getDefaultQueryParameters(
    cameraID: string,
    queryType: QueryType,
  ): DefaultQueryParameters {
    const camera = this._store.getCamera(cameraID);
    if (!camera) {
      return {};
    }
    return camera.getEngine().getDefaultQueryParameters(camera, queryType);
  }

  public generateDefaultRecordingQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialRecordingQuery,
  ): RecordingQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.Recording,
      ...partialQuery,
    });
  }

  public generateDefaultRecordingSegmentsQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.RecordingSegments,
      ...partialQuery,
    });
  }

  public generateDefaultReviewQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialReviewQuery,
  ): ReviewQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.Review,
      ...partialQuery,
    });
  }

  private _generateDefaultQueries<PQT extends PartialCameraQuery>(
    cameraIDs: string | Set<string>,
    partialQuery: PQT,
  ): PartialQueryConcreteType<PQT>[] | null {
    const concreteQueries: PartialQueryConcreteType<PQT>[] = [];
    const _cameraIDs = setify(cameraIDs);
    const engines = this._store.getEnginesForCameraIDs(_cameraIDs);
    if (!engines) {
      return null;
    }

    for (const [engine, cameraIDs] of engines) {
      let queries: CameraQuery[] | null = null;
      /* v8 ignore else: the else path cannot be reached -- @preserve */
      if (CameraQueryClassifier.isEventQuery(partialQuery)) {
        queries = engine.generateDefaultEventQuery(this._store, cameraIDs, partialQuery);
      } else if (CameraQueryClassifier.isRecordingQuery(partialQuery)) {
        queries = engine.generateDefaultRecordingQuery(
          this._store,
          cameraIDs,
          partialQuery,
        );
      } else if (CameraQueryClassifier.isRecordingSegmentsQuery(partialQuery)) {
        queries = engine.generateDefaultRecordingSegmentsQuery(
          this._store,
          cameraIDs,
          partialQuery,
        );
      } else if (CameraQueryClassifier.isReviewQuery(partialQuery)) {
        queries = engine.generateDefaultReviewQuery(
          this._store,
          cameraIDs,
          partialQuery,
        );
      }

      for (const query of queries ?? []) {
        concreteQueries.push(query as PartialQueryConcreteType<PQT>);
      }
    }
    return concreteQueries.length ? concreteQueries : null;
  }

  public async getMediaMetadata(): Promise<MediaMetadata | null> {
    const tags: Set<string> = new Set();
    const what: Set<string> = new Set();
    const where: Set<string> = new Set();
    const days: Set<string> = new Set();

    const query: MediaMetadataQuery = {
      type: QueryType.MediaMetadata,
      cameraIDs: this._store.getCameraIDs(),
    };

    const results = await this._handleQuery(query);

    for (const result of results.values()) {
      if (result.metadata.tags) {
        result.metadata.tags.forEach(tags.add, tags);
      }
      if (result.metadata.what) {
        result.metadata.what.forEach(what.add, what);
      }
      if (result.metadata.where) {
        result.metadata.where.forEach(where.add, where);
      }
      if (result.metadata.days) {
        result.metadata.days.forEach(days.add, days);
      }
    }

    if (!what.size && !where.size && !days.size && !tags.size) {
      return null;
    }
    return {
      ...(tags.size && { tags: tags }),
      ...(what.size && { what: what }),
      ...(where.size && { where: where }),
      ...(days.size && { days: days }),
    };
  }

  public async getEvents(
    query: EventQuery | EventQuery[],
    engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap> {
    return await this._handleQuery(query, engineOptions);
  }

  public async getRecordings(
    query: RecordingQuery | RecordingQuery[],
    engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap> {
    return await this._handleQuery(query, engineOptions);
  }

  public async getRecordingSegments(
    query: RecordingSegmentsQuery | RecordingSegmentsQuery[],
    engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap> {
    return await this._handleQuery(query, engineOptions);
  }

  public async executeMediaQueries<T extends MediaQuery>(
    queries: T[],
    engineOptions?: EngineOptions,
  ): Promise<ViewMedia[] | null> {
    return this._convertQueryResultsToMedia(
      await this._handleQuery(queries, engineOptions),
    );
  }

  /**
   * Merge compatible queries by combining cameraIDs for queries with identical
   * properties (other than cameraIDs). This preserves multi-camera batching for
   * engines like Frigate that support querying multiple cameras at once.
   */
  private _mergeCompatibleQueries<T extends CameraQuery>(queries: T[]): T[] {
    if (queries.length <= 1) {
      return queries;
    }

    type CameraLessQuery = Omit<T, 'cameraIDs'>;

    // Compare queries ignoring the camera parameter.
    const groups = new EqualityMap<CameraLessQuery, T>();

    for (const query of queries) {
      const key: CameraLessQuery = omit(query, 'cameraIDs');
      const existing = groups.get(key);
      if (existing) {
        // Merge cameraIDs into the existing query
        for (const id of query.cameraIDs) {
          existing.cameraIDs.add(id);
        }
      } else {
        // Clone with a new Set to avoid mutating the original
        groups.set(key, { ...query, cameraIDs: new Set(query.cameraIDs) });
      }
    }

    return Array.from(groups.values());
  }

  public async extendMediaQueries<T extends MediaQuery>(
    queries: T[],
    results: ViewItem[],
    direction: 'earlier' | 'later',
    engineOptions?: EngineOptions,
  ): Promise<ExtendedMediaQueryResult<T> | null> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass) {
      return null;
    }

    const getTimeFromResults = (want: 'earliest' | 'latest'): Date | null => {
      let output: Date | null = null;
      for (const result of results) {
        if (!ViewItemClassifier.isMedia(result)) {
          continue;
        }
        const startTime = result.getStartTime();
        if (
          startTime &&
          (!output ||
            (want === 'earliest' && startTime < output) ||
            (want === 'latest' && startTime > output))
        ) {
          output = startTime;
        }
      }
      return output;
    };

    const chunkSize =
      this._api.getConfigManager().getCardWideConfig()?.performance?.features
        .media_chunk_size ?? MEDIA_CHUNK_SIZE_DEFAULT;

    // The queries associated with the chunk to fetch.
    const newChunkQueries: T[] = [];

    // The re-constituted combined query.
    const extendedQueries: T[] = [];

    for (const query of queries) {
      const newChunkQuery = { ...query };

      /* v8 ignore else: the else path cannot be reached -- @preserve */
      if (direction === 'later') {
        const latestResult = getTimeFromResults('latest');
        if (latestResult) {
          newChunkQuery.start = latestResult;
          delete newChunkQuery.end;
        }
      } else if (direction === 'earlier') {
        const earliestResult = getTimeFromResults('earliest');
        if (earliestResult) {
          newChunkQuery.end = earliestResult;
          delete newChunkQuery.start;
        }
      }
      newChunkQuery.limit = chunkSize;

      extendedQueries.push({
        ...query,
        limit: (query.limit ?? 0) + chunkSize,
      });
      newChunkQueries.push(newChunkQuery);
    }

    const newChunkMedia = this._convertQueryResultsToMedia(
      await this._handleQuery(newChunkQueries, engineOptions),
    );

    if (!newChunkMedia.length) {
      return null;
    }

    const outputMedia = sortItems(results.concat(newChunkMedia));

    // If the media did not _ACTUALLY_ get longer, there is no new media despite
    // the increased limit, so just return null.
    if (outputMedia.length === results.length) {
      return null;
    }

    return {
      queries: extendedQueries,
      results: outputMedia,
    };
  }

  public async getMediaDownloadPath(media: ViewMedia): Promise<Endpoint | null> {
    const cameraConfig = this._store.getCameraConfigForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (!cameraConfig || !engine || !hass) {
      return null;
    }
    return await engine.getMediaDownloadPath(hass, cameraConfig, media);
  }

  public getMediaCapabilities(media: ViewMedia): ViewItemCapabilities | null {
    const engine = this._store.getEngineForMedia(media);
    if (!engine) {
      return null;
    }
    return engine.getMediaCapabilities(media);
  }

  public async favoriteMedia(media: ViewMedia, favorite: boolean): Promise<void> {
    const cameraConfig = this._store.getCameraConfigForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (!cameraConfig || !engine || !hass) {
      return;
    }

    const queryStartTime = new Date();

    await this._requestLimit.add(() =>
      engine.favoriteMedia(hass, cameraConfig, media, favorite),
    );

    log(
      this._api.getConfigManager().getCardWideConfig(),
      'Advanced Camera Card CameraManager favorite request (',
      `Duration: ${(new Date().getTime() - queryStartTime.getTime()) / 1000}s,`,
      'Media:',
      media.getID(),
      ', Favorite:',
      favorite,
      ')',
    );
  }

  public async reviewMedia(media: ViewMedia, reviewed: boolean): Promise<void> {
    const cameraConfig = this._store.getCameraConfigForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (!cameraConfig || !engine || !hass) {
      return;
    }

    const queryStartTime = new Date();

    await this._requestLimit.add(() =>
      engine.reviewMedia(hass, cameraConfig, media, reviewed),
    );

    log(
      this._api.getConfigManager().getCardWideConfig(),
      'Advanced Camera Card CameraManager review media request (',
      `Duration: ${(new Date().getTime() - queryStartTime.getTime()) / 1000}s,`,
      'Media:',
      media.getID(),
      ', Reviewed:',
      reviewed,
      ')',
    );
  }

  public areMediaQueriesResultsFresh<T extends MediaQuery>(
    resultsTimestamp: Date,
    queries: T[] | null,
  ): boolean {
    if (!queries) {
      return false;
    }

    const now = new Date();
    for (const query of queries) {
      const engines = this._store.getEnginesForCameraIDs(query.cameraIDs);
      for (const [engine, cameraIDs] of engines ?? []) {
        const maxAgeSeconds = engine.getQueryResultMaxAge({
          ...query,
          cameraIDs: cameraIDs,
        });
        if (
          maxAgeSeconds !== null &&
          add(resultsTimestamp, { seconds: maxAgeSeconds }) < now
        ) {
          return false;
        }
      }
    }
    return true;
  }

  public async getMediaSeekTime(media: ViewMedia, target: Date): Promise<number | null> {
    const startTime = media.getPlaybackStartTime();
    const endTime = media.getEndTime();
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (
      !hass ||
      !engine ||
      !startTime ||
      !endTime ||
      target < startTime ||
      target > endTime
    ) {
      return null;
    }

    return (
      (await this._requestLimit.add(() =>
        engine.getMediaSeekTime(hass, this._store, media, target),
      )) ?? null
    );
  }

  private async _handleQuery<QT extends CameraQuery>(
    query: QT | QT[],
    engineOptions?: EngineOptions,
  ): Promise<Map<QT, QueryReturnType<QT>>> {
    const _queries = this._mergeCompatibleQueries(arrayify(query));
    const results = new Map<QT, QueryReturnType<QT>>();
    const queryStartTime = new Date();
    const hass = this._api.getHASSManager().getHASS();

    if (!hass) {
      return results;
    }

    const processEngineQuery = async (
      engine: CameraManagerEngine,
      query: QT,
    ): Promise<void> => {
      let engineResult: Map<QT, QueryReturnType<QT>> | null = null;

      /* v8 ignore else: the else path cannot be reached -- @preserve */
      if (CameraQueryClassifier.isEventQuery(query)) {
        engineResult = (await engine.getEvents(
          hass,
          this._store,
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (CameraQueryClassifier.isRecordingQuery(query)) {
        engineResult = (await engine.getRecordings(
          hass,
          this._store,
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (CameraQueryClassifier.isRecordingSegmentsQuery(query)) {
        engineResult = (await engine.getRecordingSegments(
          hass,
          this._store,
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (CameraQueryClassifier.isMediaMetadataQuery(query)) {
        engineResult = (await engine.getMediaMetadata(
          hass,
          this._store,
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (CameraQueryClassifier.isReviewQuery(query)) {
        engineResult = (await engine.getReviews(
          hass,
          this._store,
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      }

      engineResult?.forEach((value, key) => results.set(key, value));
    };

    const processQuery = async (query: QT): Promise<void> => {
      const engines = this._store.getEnginesForCameraIDs(query.cameraIDs);
      if (!engines) {
        return;
      }
      await Promise.all(
        Array.from(engines.keys()).map((engine) =>
          this._requestLimit.add(() =>
            processEngineQuery(engine, { ...query, cameraIDs: engines.get(engine) }),
          ),
        ),
      );
    };

    await Promise.all(_queries.map((query) => processQuery(query)));

    const cachedOutputQueries = sum(
      Array.from(results.values()).map((result) => Number(result.cached ?? 0)),
    );

    log(
      this._api.getConfigManager().getCardWideConfig(),
      'Advanced Camera Card CameraManager request [Input queries:',
      _queries.length,
      ', Cached output queries:',
      cachedOutputQueries,
      ', Total output queries:',
      results.size,
      ', Duration:',
      `${(new Date().getTime() - queryStartTime.getTime()) / 1000}s,`,
      ', Queries:',
      _queries,
      ', Results:',
      results,
      ', Options:',
      engineOptions ?? {},
      ']',
    );
    return results;
  }

  private _convertQueryResultsToMedia<QT extends CameraQuery>(
    results: ResultsMap<QT>,
  ): ViewMedia[] {
    const mediaArray: ViewMedia[] = [];
    const hass = this._api.getHASSManager().getHASS();

    if (!hass) {
      return mediaArray;
    }

    for (const [query, result] of results.entries()) {
      const engine = this._store.getEngineOfType(result.engine);

      if (engine) {
        let media: ViewMedia[] | null = null;
        /* v8 ignore else: the else path cannot be reached -- @preserve */
        if (
          CameraQueryClassifier.isEventQuery(query) &&
          QueryResultClassifier.isEventQueryResult(result)
        ) {
          media = engine.generateMediaFromEvents(hass, this._store, query, result);
        } else if (
          CameraQueryClassifier.isRecordingQuery(query) &&
          QueryResultClassifier.isRecordingQueryResult(result)
        ) {
          media = engine.generateMediaFromRecordings(hass, this._store, query, result);
        } else if (
          CameraQueryClassifier.isReviewQuery(query) &&
          QueryResultClassifier.isReviewQueryResult(result)
        ) {
          media = engine.generateMediaFromReviews(hass, this._store, query, result);
        }
        if (media) {
          mediaArray.push(...media);
        }
      }
    }
    return sortItems(mediaArray);
  }

  public getCameraEndpoints(
    cameraID: string,
    context?: CameraEndpointsContext,
  ): CameraEndpoints | null {
    return this._store.getCamera(cameraID)?.getEndpoints(context) ?? null;
  }

  public getCameraMetadata(cameraID: string): CameraManagerCameraMetadata | null {
    const cameraConfig = this._store.getCameraConfig(cameraID);
    const engine = this._store.getEngineForCameraID(cameraID);
    const hass = this._api.getHASSManager().getHASS();

    if (!cameraConfig || !engine || !hass) {
      return null;
    }
    return engine.getCameraMetadata(hass, cameraConfig);
  }

  public getCameraCapabilities(cameraID: string): Capabilities | null {
    return this._store.getCamera(cameraID)?.getCapabilities() ?? null;
  }

  public getAggregateCameraCapabilities(cameraIDs?: Set<string>): Capabilities {
    const cameras = [...(cameraIDs ?? this._store.getCameraIDs())]
      .map((cameraID) => this._store.getCamera(cameraID))
      .filter(isTruthy);

    return new Capabilities({
      live: cameras.some((camera) => camera.getCapabilities()?.has('live')),
      clips: cameras.some((camera) => camera.getCapabilities()?.has('clips')),
      recordings: cameras.some((camera) => camera.getCapabilities()?.has('recordings')),
      snapshots: cameras.some((camera) => camera.getCapabilities()?.has('snapshots')),
      'favorite-events': cameras.some((camera) =>
        camera.getCapabilities()?.has('favorite-events'),
      ),
      'favorite-recordings': cameras.some((camera) =>
        camera.getCapabilities()?.has('favorite-recordings'),
      ),
      seek: cameras.some((camera) => camera.getCapabilities()?.has('seek')),
      menu: cameras.some((camera) => camera.getCapabilities()?.has('menu')),
    });
  }

  /**
   * Rotate a PTZ action based on camera rotation setting.
   * When camera view is rotated, PTZ controls should logically rotate too.
   * For example: with 90° rotation, pressing "left" should send "down" to camera.
   */
  private _rotatePTZAction(action: PTZAction, rotation?: Rotation): PTZAction {
    if (
      !rotation ||
      action === 'preset' ||
      action === 'zoom_in' ||
      action === 'zoom_out'
    ) {
      return action;
    }

    // Directions in clockwise order for rotation calculation.
    const CLOCKWISE: PTZPanTiltAction[] = ['up', 'right', 'down', 'left'];
    const index = CLOCKWISE.indexOf(action);

    // Each 90° rotation shifts the direction index counter-clockwise.
    const shift = (4 - rotation / 90) % 4;
    return CLOCKWISE[(index + shift) % 4];
  }

  public async executePTZAction(
    cameraID: string,
    action: PTZAction,
    options?: {
      phase?: PTZActionPhase;
      preset?: string;
    },
  ): Promise<void> {
    const camera = this._store.getCamera(cameraID);
    if (!camera) {
      return;
    }
    const rotatedAction = this._rotatePTZAction(
      action,
      camera.getConfig().dimensions?.rotation,
    );
    const hass = this._api.getHASSManager().getHASS();
    await this._requestLimit.add(() =>
      camera.executePTZAction(this._api.getActionsManager(), rotatedAction, {
        ...options,
        hass: hass ?? undefined,
      }),
    );
  }
}
