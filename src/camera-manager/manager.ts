import { add } from 'date-fns';
import { cloneDeep, sum } from 'lodash-es';
import PQueue from 'p-queue';
import { CardCameraAPI } from '../card-controller/types.js';
import { sortItems } from '../card-controller/view/sort.js';
import {
  PTZ_PAN_TILT_ACTIONS,
  PTZAction,
  PTZActionPhase,
  PTZPanTiltAction,
} from '../config/schema/actions/custom/ptz.js';
import { CameraConfig, CamerasConfig, Rotation } from '../config/schema/cameras.js';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const.js';
import { localize } from '../localize/localize.js';
import { Endpoint } from '../types.js';
import {
  allPromises,
  arrayify,
  isTruthy,
  recursivelyMergeObjectsNotArrays,
  setify,
} from '../utils/basic.js';
import { getCameraID } from '../utils/camera.js';
import { log } from '../utils/debug.js';
import { ViewItemClassifier } from '../view/item-classifier.js';
import { ViewItem, ViewMedia } from '../view/item.js';
import { ViewItemCapabilities } from '../view/types.js';
import { Capabilities } from './capabilities.js';
import { CameraManagerEngineFactory } from './engine-factory.js';
import { CameraManagerEngine } from './engine.js';
import { CameraInitializationError } from './error.js';
import { CameraManagerReadOnlyConfigStore, CameraManagerStore } from './store.js';
import {
  CameraEndpoints,
  CameraEndpointsContext,
  CameraManagerCameraMetadata,
  CameraQuery,
  Engine,
  EngineOptions,
  EventQuery,
  EventQueryResults,
  EventQueryResultsMap,
  MediaMetadata,
  MediaMetadataQuery,
  MediaMetadataQueryResults,
  MediaQuery,
  PartialCameraQuery,
  PartialEventQuery,
  PartialQueryConcreteType,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryResults,
  QueryResultsType,
  QueryReturnType,
  QueryType,
  RecordingQuery,
  RecordingQueryResults,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResults,
  RecordingSegmentsQueryResultsMap,
  ResultsMap,
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
}

export interface ExtendedMediaQueryResult<T extends MediaQuery> {
  queries: T[];
  results: ViewItem[];
}

export class CameraManager {
  protected _api: CardCameraAPI;
  protected _engineFactory: CameraManagerEngineFactory;
  protected _store: CameraManagerStore;
  protected _requestLimit = new PQueue();

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
      new CameraManagerEngineFactory(this._api.getEntityRegistryManager());
    this._store = options?.store ?? new CameraManagerStore();
  }

  public async initializeCamerasFromConfig(): Promise<boolean> {
    const config = this._api.getConfigManager().getConfig();
    const hass = this._api.getHASSManager().getHASS();

    if (!config || !hass) {
      return false;
    }

    this._requestLimit.concurrency =
      config.performance.features.max_simultaneous_engine_requests ?? Infinity;

    // For each camera merge the config (which has no defaults) into the camera
    // global config (which does have defaults). The merging must happen in this
    // order, to ensure that the defaults in the cameras global config do not
    // override the values specified in the per-camera config.
    const cameras = config.cameras.map((camera) =>
      recursivelyMergeObjectsNotArrays({}, cloneDeep(config?.cameras_global), camera),
    );

    try {
      await this._initializeCameras(cameras);
    } catch (e: unknown) {
      this._api
        .getMessageManager()
        .setErrorIfHigherPriority(e, localize('error.camera_initialization'));
      return false;
    }
    return true;
  }

  public async destroy(): Promise<void> {
    await this._store.reset();
  }

  protected async _getEnginesForCameras(
    camerasConfig: CamerasConfig,
  ): Promise<Map<CameraConfig, CameraManagerEngine>> {
    const output: Map<CameraConfig, CameraManagerEngine> = new Map();
    const engines: Map<Engine, CameraManagerEngine> = new Map();
    const hass = this._api.getHASSManager().getHASS();

    /* istanbul ignore if: the if path cannot be reached -- @preserve */
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
            eventCallback: (ev) => this._api.getTriggersManager().handleCameraEvent(ev),
            stateWatcher: this._api.getHASSManager().getStateWatcher(),
            resolvedMediaCache: this._api.getResolvedMediaCache(),
          }))
        : null;
      if (!engine || !engineType) {
        throw new CameraInitializationError(
          localize('error.no_camera_engine'),
          // Camera initialization may modify the configuration. Keep the
          // original config unchanged.
          cloneDeep(cameraConfig),
        );
      }
      engines.set(engineType, engine);
      output.set(cameraConfig, engine);
    }
    return output;
  }

  protected async _initializeCameras(camerasConfig: CamerasConfig): Promise<void> {
    const initializationStartTime = new Date();
    const hass = this._api.getHASSManager().getHASS();

    /* istanbul ignore if: the if path cannot be reached -- @preserve */
    if (!hass) {
      return;
    }

    const hasAutoTriggers = (config: CameraConfig): boolean => {
      return config.triggers.motion || config.triggers.occupancy;
    };

    if (
      // If any camera requires automatic trigger detection ...
      camerasConfig.some((config) => hasAutoTriggers(config))
    ) {
      // ... then we need to populate the entity cache by fetching all entities
      // from Home Assistant. Attempt to do this once upfront, to avoid each
      // camera doing needing to fetch entity state.
      await this._api.getEntityRegistryManager().fetchEntityList(hass);
    }

    // Engines are created sequentially, to avoid duplicate creation of the same
    // engine. See: https://github.com/dermotduffy/advanced-camera-card/issues/941
    const engineByConfig = await this._getEnginesForCameras(camerasConfig);

    // Configuration is initialized in parallel.
    const cameras = await allPromises(
      engineByConfig.entries(),
      async ([cameraConfig, engine]) => await engine.createCamera(hass, cameraConfig),
    );

    const destroyCameras = async () => {
      cameras.forEach((camera) => camera.destroy());
    };
    const cameraIDs: Set<string> = new Set();

    // Do the additions based off the result-order, to ensure the map order is
    // preserved.
    for (const camera of cameras) {
      const cameraID = getCameraID(camera.getConfig());

      if (!cameraID) {
        await destroyCameras();
        throw new CameraInitializationError(
          localize('error.no_camera_id'),
          camera.getConfig(),
        );
      }

      if (cameraIDs.has(cameraID)) {
        await destroyCameras();
        throw new CameraInitializationError(
          localize('error.duplicate_camera_id'),
          camera.getConfig(),
        );
      }

      // Always ensure the actual ID used in the card is in the configuration itself.
      camera.setID(cameraID);
      cameraIDs.add(cameraID);
    }

    await this._store.setCameras(cameras);

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

  protected _generateDefaultQueries<PQT extends PartialCameraQuery>(
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
      /* istanbul ignore else: the else path cannot be reached -- @preserve */
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

      /* istanbul ignore else: the else path cannot be reached -- @preserve */
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
    const startTime = media.getStartTime();
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

  protected async _handleQuery<QT extends CameraQuery>(
    query: QT | QT[],
    engineOptions?: EngineOptions,
  ): Promise<Map<QT, QueryReturnType<QT>>> {
    const _queries = arrayify(query);
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

      /* istanbul ignore else: the else path cannot be reached -- @preserve */
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

  protected _convertQueryResultsToMedia<QT extends CameraQuery>(
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
        /* istanbul ignore else: the else path cannot be reached -- @preserve */
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
    const cameraConfig = this._store.getCameraConfig(cameraID);
    const engine = this._store.getEngineForCameraID(cameraID);
    if (!cameraConfig || !engine) {
      return null;
    }
    return engine.getCameraEndpoints(cameraConfig, context);
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
    if (!rotation) {
      return action;
    }

    // Pan/tilt directions in clockwise order for rotation calculation
    const index = PTZ_PAN_TILT_ACTIONS.indexOf(action as PTZPanTiltAction);

    if (index === -1) {
      // Not a directional action (e.g., zoom_in, zoom_out, preset)
      return action;
    }

    // Each 90° rotation shifts the direction index counter-clockwise.
    const shift = (4 - rotation / 90) % 4;
    return PTZ_PAN_TILT_ACTIONS[(index + shift) % 4];
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
    await this._requestLimit.add(() =>
      camera.executePTZAction(this._api.getActionsManager(), rotatedAction, options),
    );
  }
}
