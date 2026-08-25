import { add } from 'date-fns';
import { omit, sum } from 'lodash-es';
import PQueue from 'p-queue';

import { EqualityMap } from '../cache/equality-map.js';
import type { CameraInitializationState } from '../card-controller/issues/issues/camera-initialization.js';
import type { CardCameraAPI } from '../card-controller/types.js';
import { sortItems } from '../card-controller/view/sort.js';
import type {
  PTZAction,
  PTZActionPhase,
  PTZPanTiltAction,
} from '../config/schema/actions/custom/ptz.js';
import type { Rotation } from '../config/schema/cameras.js';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const.js';
import type { Endpoint } from '../types.js';
import { arrayify, errorToConsole, isTruthy, setify } from '../utils/basic.js';
import { Generation } from '../utils/concurrency/generation.js';
import { log } from '../utils/debug.js';
import { ViewItemClassifier } from '../view/item-classifier.js';
import type { ViewItem, ViewMedia } from '../view/item.js';
import type { ViewItemCapabilities } from '../view/types.js';
import type { Camera } from './camera.js';
import { Capabilities } from './capabilities.js';
import type { CameraManagerEngine } from './engine.js';
import {
  CameraLifecycleStatus,
  type CameraLifecycleState,
  type CameraManagerEpoch,
} from './lifecycle.js';
import { CameraManagerStore, type CameraManagerReadOnlyConfigStore } from './store.js';
import {
  QueryResultsType,
  QueryType,
  type CameraEndpoints,
  type CameraEndpointsContext,
  type CameraManagerCameraMetadata,
  type CameraQuery,
  type DefaultQueryParameters,
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

interface SetCamerasOptions {
  // Concurrency limit for engine requests (queries and probes).
  engineRequestConcurrency?: number;
}

export class CameraManager {
  private _api: CardCameraAPI;
  private _store: CameraManagerStore;
  private _requestLimit = new PQueue();

  // Cameras take time to initialize, so a teardown or a newer set of cameras
  // can arrive mid-initialization and leave the finished cameras with no owner.
  private _generation = new Generation();

  // Handing cameras to the store is not atomic, so commits and teardowns run
  // one at a time and cannot observe each other half-applied.
  private _storeCommits = new PQueue({ concurrency: 1 });

  private _lifecycleStates = new Map<string, CameraLifecycleState>();
  private _epoch: CameraManagerEpoch = { manager: this };

  constructor(
    api: CardCameraAPI,
    options?: {
      store?: CameraManagerStore;
    },
  ) {
    this._api = api;
    this._store = options?.store ?? new CameraManagerStore();
  }

  /**
   * Take ownership of a set of uninitialized cameras. The cameras are added to
   * the store immediately so the card can render them right away with
   * provisional capabilities, then each camera initializes in the background
   * (async network requests) and, on success, subscribes and becomes ready on its
   * own. `setCameras` resolves once the cameras are in the store. One camera
   * failing initialization does not affect the others: it is marked failed and
   * the rest proceed.
   */
  public async setCameras(
    cameras: Camera[],
    options?: SetCamerasOptions,
  ): Promise<void> {
    const generation = this._generation.next();

    this._requestLimit.concurrency = options?.engineRequestConcurrency ?? Infinity;

    // A new set of cameras is a new set of trigger sources, so the triggers of
    // the previous set are discarded here. Runs before any camera can become
    // ready, so it cannot discard the triggers of a camera in this set.
    this._api.getCameraTriggersManager().reset();
    this._api.getIssueManager().reset('camera_initialization');

    // Adding the cameras to the store runs on the commit queue so it is
    // serialized with the background commits and teardowns that mutate the store
    // one at a time.
    await this._storeCommits.add(() => this._storeCameras(cameras));

    // A newer set of cameras or a teardown may have superseded these cameras
    // while they were being added to the store, in which case they are no longer
    // in it and must not be initialized.
    if (!this._generation.isCurrent(generation)) {
      return;
    }

    for (const camera of cameras) {
      // Fire-and-forget: `_initializeCamera` handles the actionable failures
      // itself, so this only guards against an unexpected rejection in it.
      this._initializeCamera(camera, generation).catch(() => {});
    }
  }

  private _storeCameras(cameras: Camera[]): void {
    const displaced = this._store.setCameras(cameras);
    displaced.forEach((camera) => camera.unsubscribe());

    for (const camera of cameras) {
      this._setCameraLifecycleState(camera.getID(), {
        status: CameraLifecycleStatus.Initializing,
      });
    }

    const currentIDs = new Set(cameras.map((camera) => camera.getID()));
    for (const cameraID of this._lifecycleStates.keys()) {
      if (!currentIDs.has(cameraID)) {
        this._lifecycleStates.delete(cameraID);
      }
    }

    log(
      this._api.getConfigManager().getCardWideConfig(),
      'Advanced Camera Card CameraManager stored cameras (',
      this._store.getCameras(),
      ')',
    );
  }

  private async _initializeCamera(camera: Camera, generation: number): Promise<void> {
    try {
      await this._requestLimit.add(() => camera.initialize());
    } catch (error) {
      await this._commitFailedCamera(camera, error, generation);
      return;
    }

    if (
      (await this._commitInitializedCamera(camera, generation)) &&
      this._generation.isCurrent(generation)
    ) {
      await this._api.getCameraTriggersManager().handleCameraReady(camera.getID());
    }
  }

  // Returns whether the camera became ready. A camera that could not initialize
  // fully is still served; a camera that throws while subscribing is marked
  // failed and left unsubscribed.
  private async _commitInitializedCamera(
    camera: Camera,
    generation: number,
  ): Promise<boolean> {
    let ready = false;
    await this._storeCommits.add(() => {
      if (!this._generation.isCurrent(generation)) {
        return;
      }

      try {
        camera.subscribe();
      } catch (error) {
        camera.unsubscribe();
        this._setCameraLifecycleState(camera.getID(), {
          status: CameraLifecycleStatus.Failed,
          error,
        });
        this._triggerCameraInitializationIssue(camera.getID(), 'failed', error);
        return;
      }
      this._setCameraLifecycleState(camera.getID(), {
        status: CameraLifecycleStatus.Ready,
      });
      this._triggerOrResolveCameraInitializationIssue(camera);
      ready = true;
    });

    return ready;
  }

  private _triggerOrResolveCameraInitializationIssue(camera: Camera): void {
    const cameraID = camera.getID();
    if (camera.isDegraded()) {
      this._triggerCameraInitializationIssue(cameraID, 'degraded');
    } else {
      this._api.getIssueManager().resolve('camera_initialization', { cameraID });
    }
  }

  private _triggerCameraInitializationIssue(
    cameraID: string,
    state: CameraInitializationState,
    error?: unknown,
  ): void {
    this._api.getIssueManager().trigger('camera_initialization', {
      cameraID,
      state,
      error,
    });
  }

  private async _commitFailedCamera(
    camera: Camera,
    error: unknown,
    generation: number,
  ): Promise<void> {
    let committed = false;
    await this._storeCommits.add(() => {
      if (!this._generation.isCurrent(generation)) {
        return;
      }
      this._setCameraLifecycleState(camera.getID(), {
        status: CameraLifecycleStatus.Failed,
        error,
      });
      this._triggerCameraInitializationIssue(camera.getID(), 'failed', error);
      committed = true;
    });

    if (committed) {
      errorToConsole(error);
    }
  }

  public async reinitializeCamera(cameraID: string): Promise<void> {
    const generation = this._generation.current();
    const camera = this._store.getCamera(cameraID);
    if (!camera) {
      return;
    }

    if (this._lifecycleStates.get(cameraID)?.status === CameraLifecycleStatus.Failed) {
      this._setCameraLifecycleState(cameraID, {
        status: CameraLifecycleStatus.Initializing,
      });
      await this._initializeCamera(camera, generation);
      return;
    }

    await this._reinitializeCamera(camera, generation);
  }

  private async _reinitializeCamera(camera: Camera, generation: number): Promise<void> {
    let changed = false;
    let reinitializationFailed = false;

    try {
      changed = await camera.reinitialize();
    } catch (error) {
      errorToConsole(error);
      reinitializationFailed = true;
    }

    await this._storeCommits.add(() => {
      if (!this._generation.isCurrent(generation)) {
        return;
      }
      if (changed) {
        this._replaceEpoch();
      }
      if (reinitializationFailed) {
        this._triggerCameraInitializationIssue(camera.getID(), 'degraded');
        return;
      }
      this._triggerOrResolveCameraInitializationIssue(camera);
    });
  }

  public async destroy(): Promise<void> {
    this._generation.invalidate();
    this._api.getIssueManager().reset('camera_initialization');
    await this._storeCommits.add(() => {
      this._store.reset().forEach((camera) => camera.unsubscribe());
      this._lifecycleStates.clear();
    });
  }

  public getCameraLifecycleState(cameraID: string): CameraLifecycleState | null {
    return this._lifecycleStates.get(cameraID) ?? null;
  }

  // Whether any camera is still initializing in the background.
  public hasInitializingCameras(): boolean {
    return [...this._lifecycleStates.values()].some(
      (state) => state.status === CameraLifecycleStatus.Initializing,
    );
  }

  public getEpoch(): CameraManagerEpoch {
    return this._epoch;
  }

  private _setCameraLifecycleState(cameraID: string, state: CameraLifecycleState): void {
    this._lifecycleStates.set(cameraID, state);
    this._replaceEpoch();
  }

  private _replaceEpoch(): void {
    this._epoch = { manager: this };
    this._api.getCardElementManager().update();
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
  private _mergeCompatibleQueries<T extends CameraQuery>(
    queries: readonly T[],
  ): readonly T[] {
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
    const camera = this._store.getCameraForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (!camera || !engine || !hass) {
      return null;
    }
    return await engine.getMediaDownloadPath(hass, camera, media);
  }

  public getMediaCapabilities(media: ViewMedia): ViewItemCapabilities | null {
    const engine = this._store.getEngineForMedia(media);
    if (!engine) {
      return null;
    }
    return engine.getMediaCapabilities(media);
  }

  public async favoriteMedia(media: ViewMedia, favorite: boolean): Promise<void> {
    const camera = this._store.getCameraForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (!camera || !engine || !hass) {
      return;
    }

    const queryStartTime = new Date();

    await this._requestLimit.add(() =>
      engine.favoriteMedia(hass, camera, media, favorite),
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
    const camera = this._store.getCameraForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    const hass = this._api.getHASSManager().getHASS();

    if (!camera || !engine || !hass) {
      return;
    }

    const queryStartTime = new Date();

    await this._requestLimit.add(() =>
      engine.reviewMedia(hass, camera, media, reviewed),
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
    const camera = this._store.getCamera(cameraID);
    const engine = this._store.getEngineForCameraID(cameraID);
    const hass = this._api.getHASSManager().getHASS();

    if (!camera || !engine || !hass) {
      return null;
    }
    return engine.getCameraMetadata(hass, camera);
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
