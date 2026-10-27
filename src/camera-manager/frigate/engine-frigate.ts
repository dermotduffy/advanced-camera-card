import { add, fromUnixTime } from 'date-fns';
import { isEqual, orderBy, throttle, uniqWith } from 'lodash-es';

import type { HASSManagerReadonlyInterface } from '../../card-controller/hass/types';
import type { CameraConfig } from '../../config/schema/cameras';
import { getEntityTitle } from '../../ha/get-entity-title';
import type { EntityRegistryManager } from '../../ha/registry/entity/types';
import type { HomeAssistant } from '../../ha/types';
import { hasUnsupportedFilters, QuerySource } from '../../query-source.js';
import type { Endpoint } from '../../types';
import { allPromises, prettifyTitle, runWhenIdleIfSupported } from '../../utils/basic';
import {
  createDayHourResolver,
  endOfHourInTimeZone,
  hourInTimeZoneToDate,
  startOfHourInTimeZone,
} from '../../utils/timezone';
import { ViewMediaType, type ViewMedia } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import type { ViewItemCapabilities } from '../../view/types';
import type { RecordingSegmentsCache } from '../cache';
import type { Camera } from '../camera';
import {
  CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT,
  type CameraManagerEngine,
} from '../engine';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import type { DateRange } from '../range';
import type { CameraManagerReadOnlyConfigStore } from '../store';
import {
  Engine,
  QueryResultsType,
  QueryType,
  type CameraEventCallback,
  type CameraManagerCameraMetadata,
  type CameraManagerRequestCache,
  type CameraQuery,
  type DefaultQueryParameters,
  type EngineOptions,
  type EventQuery,
  type EventQueryResults,
  type EventQueryResultsMap,
  type MediaMetadataQuery,
  type MediaMetadataQueryResults,
  type MediaMetadataQueryResultsMap,
  type PartialEventQuery,
  type PartialRecordingQuery,
  type PartialRecordingSegmentsQuery,
  type PartialReviewQuery,
  type QueryResults,
  type QueryReturnType,
  type RecordingQuery,
  type RecordingQueryResults,
  type RecordingQueryResultsMap,
  type RecordingSegment,
  type RecordingSegmentsQuery,
  type RecordingSegmentsQueryResultsMap,
  type ReviewQuery,
  type ReviewQueryResultsMap,
} from '../types';
import { expandRangeByRetentionMargin } from '../utils/recording-retention';
import { FrigateCamera, isBirdseye } from './camera';
import { FrigateViewMediaFactory } from './media';
import { FrigateViewMediaClassifier } from './media-classifier';
import {
  getEvents,
  getEventSummary,
  getRecordingSegments,
  getRecordingsSummary,
  getReviews,
  retainEvent,
  setReviewsReviewed,
  type NativeFrigateEventQuery,
  type NativeFrigateRecordingSegmentsQuery,
} from './requests';
import {
  FRIGATE_SEVERITY_MAP,
  type FrigateEventQueryResults,
  type FrigateRecording,
  type FrigateRecordingQueryResults,
  type FrigateRecordingSegmentsQueryResults,
  type FrigateReviewQueryResults,
} from './types';
import { FrigateEventWatcher, FrigateReviewWatcher } from './watcher';

const EVENT_REQUEST_CACHE_MAX_AGE_SECONDS = 60;
const RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS = 60;
const MEDIA_METADATA_REQUEST_CACHE_AGE_SECONDS = 60;
const REVIEW_REQUEST_CACHE_MAX_AGE_SECONDS = 60;

export class FrigateQueryResultsClassifier {
  public static isFrigateEventQueryResults(
    results: QueryResults,
  ): results is FrigateEventQueryResults {
    return results.engine === Engine.Frigate && results.type === QueryResultsType.Event;
  }

  public static isFrigateRecordingQueryResults(
    results: QueryResults,
  ): results is FrigateRecordingQueryResults {
    return (
      results.engine === Engine.Frigate && results.type === QueryResultsType.Recording
    );
  }

  public static isFrigateRecordingSegmentsResults(
    results: QueryResults,
  ): results is FrigateRecordingSegmentsQueryResults {
    return (
      results.engine === Engine.Frigate &&
      results.type === QueryResultsType.RecordingSegments
    );
  }

  public static isFrigateReviewQueryResults(
    results: QueryResults,
  ): results is FrigateReviewQueryResults {
    return results.engine === Engine.Frigate && results.type === QueryResultsType.Review;
  }
}

export class FrigateCameraManagerEngine
  extends GenericCameraManagerEngine
  implements CameraManagerEngine
{
  protected override _entityRegistryManager: EntityRegistryManager;
  private _frigateEventWatcher: FrigateEventWatcher;
  private _frigateReviewWatcher: FrigateReviewWatcher;
  private _recordingSegmentsCache: RecordingSegmentsCache;
  private _requestCache: CameraManagerRequestCache;

  // Garbage collect segments at most once an hour.
  private _throttledSegmentGarbageCollector = throttle(
    this._garbageCollectSegments.bind(this),
    60 * 60 * 1000,
    { leading: false, trailing: true },
  );

  constructor(
    entityRegistryManager: EntityRegistryManager,
    hassManager: HASSManagerReadonlyInterface,
    recordingSegmentsCache: RecordingSegmentsCache,
    requestCache: CameraManagerRequestCache,
    eventCallback?: CameraEventCallback,
  ) {
    super(hassManager, entityRegistryManager, eventCallback);
    this._entityRegistryManager = entityRegistryManager;
    this._frigateEventWatcher = new FrigateEventWatcher(hassManager);
    this._frigateReviewWatcher = new FrigateReviewWatcher(hassManager);
    this._recordingSegmentsCache = recordingSegmentsCache;
    this._requestCache = requestCache;
  }

  public getEngineType(): Engine {
    return Engine.Frigate;
  }

  public async createCamera(cameraConfig: CameraConfig): Promise<Camera> {
    const camera = new FrigateCamera(cameraConfig, this, {
      eventCallback: this._eventCallback,
    });
    return await camera.initialize({
      hassManager: this._hassManager,
      entityRegistryManager: this._entityRegistryManager,
      frigateEventWatcher: this._frigateEventWatcher,
      frigateReviewWatcher: this._frigateReviewWatcher,
    });
  }

  public override getDefaultQueryParameters(
    camera: Camera,
    queryType: QueryType,
  ): DefaultQueryParameters {
    if (queryType !== QueryType.Event && queryType !== QueryType.Review) {
      return {};
    }

    const cameraConfig = camera.getConfig();
    return {
      ...(cameraConfig.frigate.labels && { what: new Set(cameraConfig.frigate.labels) }),
      ...(cameraConfig.frigate.zones && { where: new Set(cameraConfig.frigate.zones) }),
    };
  }

  public async getMediaDownloadPath(
    _hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
  ): Promise<Endpoint | null> {
    if (!cameraConfig.frigate.client_id) {
      return null;
    }
    if (FrigateViewMediaClassifier.isFrigateEvent(media)) {
      return {
        endpoint:
          `/api/frigate/${cameraConfig.frigate.client_id}` +
          `/notifications/${media.getID()}/` +
          `${ViewItemClassifier.isClip(media) ? 'clip.mp4' : 'snapshot.jpg'}` +
          `?download=true`,
        sign: true,
      };
    } else if (FrigateViewMediaClassifier.isFrigateRecording(media)) {
      return {
        endpoint:
          `/api/frigate/${cameraConfig.frigate.client_id}` +
          `/recording/${cameraConfig.frigate.camera_name}` +
          `/start/${Math.floor(media.getStartTime().getTime() / 1000)}` +
          `/end/${Math.floor(media.getEndTime().getTime() / 1000)}` +
          `?download=true`,
        sign: true,
      };
    }
    return null;
  }

  public generateDefaultEventQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query?: PartialEventQuery,
  ): EventQuery[] | null {
    return this._generateBatchableQuery(store, cameraIDs, {
      type: QueryType.Event,
      ...query,
    });
  }

  public generateDefaultRecordingQuery(
    _store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query?: PartialRecordingQuery,
  ): RecordingQuery[] {
    return [
      {
        source: QuerySource.Camera,
        type: QueryType.Recording,
        cameraIDs: cameraIDs,
        ...query,
      },
    ];
  }

  public generateDefaultRecordingSegmentsQuery(
    _store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    if (!query.start || !query.end) {
      return null;
    }
    return [
      {
        type: QueryType.RecordingSegments,
        cameraIDs: cameraIDs,
        start: query.start,
        end: query.end,
        ...query,
      },
    ];
  }

  public generateDefaultReviewQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query?: PartialReviewQuery,
  ): ReviewQuery[] | null {
    return this._generateBatchableQuery(store, cameraIDs, {
      type: QueryType.Review,
      ...query,
    });
  }

  /**
   * Helper to generate batchable queries for events and reviews.
   * If all cameras have identical zones/labels config, creates a single batch query.
   * Otherwise fans out to per-camera queries.
   */
  private _generateBatchableQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialEventQuery & { type: QueryType.Event },
  ): EventQuery[] | null;
  private _generateBatchableQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialReviewQuery & { type: QueryType.Review },
  ): ReviewQuery[] | null;
  private _generateBatchableQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: (PartialEventQuery | PartialReviewQuery) & {
      type: QueryType.Event | QueryType.Review;
    },
  ): (EventQuery | ReviewQuery)[] | null {
    const relevantCameraConfigs = [...store.getCameraConfigs(cameraIDs)];

    // If all cameras specify exactly the same zones or labels (incl. none), we
    // can use a single batch query which will be better performance wise,
    // otherwise we must fan out to multiple queries in order to precisely match
    // the user's intent.
    const uniqueZoneArrays = uniqWith(
      relevantCameraConfigs.map((config) => config?.frigate.zones),
      isEqual,
    );
    const uniqueLabelArrays = uniqWith(
      relevantCameraConfigs.map((config) => config?.frigate.labels),
      isEqual,
    );

    if (uniqueZoneArrays.length === 1 && uniqueLabelArrays.length === 1) {
      return [
        {
          source: QuerySource.Camera,
          ...query,
          cameraIDs: cameraIDs,
          ...(uniqueLabelArrays[0] && { what: new Set(uniqueLabelArrays[0]) }),
          ...(uniqueZoneArrays[0] && { where: new Set(uniqueZoneArrays[0]) }),
        },
      ];
    }

    const output: (EventQuery | ReviewQuery)[] = [];
    for (const cameraID of cameraIDs) {
      const cameraConfig = store.getCameraConfig(cameraID);
      if (cameraConfig) {
        output.push({
          source: QuerySource.Camera,
          ...query,
          cameraIDs: new Set([cameraID]),
          ...(cameraConfig.frigate.labels && {
            what: new Set(cameraConfig.frigate.labels),
          }),
          ...(cameraConfig.frigate.zones && {
            where: new Set(cameraConfig.frigate.zones),
          }),
        });
      }
    }
    return output.length ? output : null;
  }

  // Return every cached payload with the given id; there can be several, since
  // each query parses its own returned data from Frigate. The cache holds
  // results of every query type, so `select` returns the payloads within a
  // result, or null if it does not handle that type.
  private _getCachedPayloads<T extends { id: string }>(
    id: string,
    select: (results: QueryResults) => T[] | null,
  ): T[] {
    const payloads: T[] = [];
    for (const [, results] of this._requestCache.entries()) {
      payloads.push(...(select(results) ?? []).filter((payload) => payload.id === id));
    }
    return payloads;
  }

  public async favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void> {
    const instanceID = cameraConfig.frigate.client_id;
    if (!FrigateViewMediaClassifier.isFrigateEvent(media) || !instanceID) {
      return;
    }

    const eventID = media.getID();
    await retainEvent(hass, instanceID, eventID, favorite);

    const cachedEvents = this._getCachedPayloads(eventID, (results) =>
      FrigateQueryResultsClassifier.isFrigateEventQueryResults(results) &&
      results.instanceID === instanceID
        ? results.events
        : null,
    );

    media.setFavorite(favorite);
    cachedEvents.forEach((event) => (event.retain_indefinitely = favorite));
  }

  public async reviewMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    reviewed: boolean,
  ): Promise<void> {
    const instanceID = cameraConfig.frigate.client_id;
    if (!FrigateViewMediaClassifier.isFrigateReview(media) || !instanceID) {
      return;
    }

    const reviewID = media.getID();
    await setReviewsReviewed(hass, instanceID, [reviewID], reviewed);

    const cachedReviews = this._getCachedPayloads(reviewID, (results) =>
      FrigateQueryResultsClassifier.isFrigateReviewQueryResults(results) &&
      results.instanceID === instanceID
        ? results.reviews
        : null,
    );

    media.setReviewed(reviewed);
    cachedReviews.forEach((review) => (review.has_been_reviewed = reviewed));
  }

  private _buildInstanceToCameraIDMapFromQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
  ): Map<string, Set<string>> {
    const output: Map<string, Set<string>> = new Map();
    for (const cameraID of cameraIDs) {
      const cameraConfig = this._getQueryableCameraConfig(store, cameraID);
      const clientID = cameraConfig?.frigate.client_id;
      if (clientID) {
        if (!output.has(clientID)) {
          output.set(clientID, new Set());
        }
        output.get(clientID)?.add(cameraID);
      }
    }
    return output;
  }

  private _getFrigateCameraNamesForCameraIDs(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
  ): Set<string> {
    const output = new Set<string>();
    for (const cameraID of cameraIDs) {
      const cameraConfig = this._getQueryableCameraConfig(store, cameraID);
      if (cameraConfig?.frigate.camera_name) {
        output.add(cameraConfig.frigate.camera_name);
      }
    }
    return output;
  }

  public async getEvents(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: EventQuery,
    engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap | null> {
    if (
      hasUnsupportedFilters(query, {
        favorite: true,
        tags: true,
        what: true,
        where: true,
      })
    ) {
      return null;
    }

    const output: EventQueryResultsMap = new Map();

    const processInstanceQuery = async (
      instanceID: string,
      cameraIDs?: Set<string>,
    ): Promise<void> => {
      /* v8 ignore next: defensive guard, instances.get() always returns
         a value when iterating instances.keys() -- @preserve */
      if (!cameraIDs?.size) {
        return;
      }
      const instanceQuery = { ...query, cameraIDs: cameraIDs };
      const cachedResult =
        (engineOptions?.useCache ?? true) ? this._requestCache.get(instanceQuery) : null;
      if (cachedResult) {
        output.set(instanceQuery, cachedResult as EventQueryResults);
        return;
      }

      const nativeQuery: NativeFrigateEventQuery = {
        instance_id: instanceID,
        cameras: Array.from(this._getFrigateCameraNamesForCameraIDs(store, cameraIDs)),
        ...(query.what && { labels: Array.from(query.what) }),
        ...(query.where && { zones: Array.from(query.where) }),
        ...(query.tags && { sub_labels: Array.from(query.tags) }),
        ...(query.end && { before: Math.floor(query.end.getTime() / 1000) }),
        ...(query.start && { after: Math.floor(query.start.getTime() / 1000) }),
        ...(query.limit && { limit: query.limit }),
        ...(query.hasClip && { has_clip: query.hasClip }),
        ...(query.hasSnapshot && { has_snapshot: query.hasSnapshot }),
        ...(query.favorite && { favorites: query.favorite }),
        limit: query?.limit ?? CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT,
      };

      const result: FrigateEventQueryResults = {
        type: QueryResultsType.Event,
        engine: Engine.Frigate,
        instanceID: instanceID,
        events: await getEvents(hass, nativeQuery),
        expiry: add(new Date(), { seconds: EVENT_REQUEST_CACHE_MAX_AGE_SECONDS }),
        cached: false,
      };

      if (engineOptions?.useCache ?? true) {
        this._requestCache.set(
          instanceQuery,
          { ...result, cached: true },
          result.expiry,
        );
      }
      output.set(instanceQuery, result);
    };

    // Frigate allows multiple cameras to be searched for events in a single
    // query. Break them down into groups of cameras per Frigate instance, then
    // query once per instance for all cameras in that instance.
    const instances = this._buildInstanceToCameraIDMapFromQuery(store, query.cameraIDs);

    await Promise.all(
      Array.from(instances.keys()).map((instanceID) =>
        processInstanceQuery(instanceID, instances.get(instanceID)),
      ),
    );
    return output.size ? output : null;
  }

  public async getReviews(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: ReviewQuery,
    engineOptions?: EngineOptions,
  ): Promise<ReviewQueryResultsMap | null> {
    if (
      hasUnsupportedFilters(query, {
        what: true,
        where: true,
        reviewed: true,
        severity: true,
      })
    ) {
      return null;
    }

    const output: ReviewQueryResultsMap = new Map();

    const processInstanceQuery = async (
      instanceID: string,
      cameraIDs?: Set<string>,
    ): Promise<void> => {
      /* v8 ignore next: defensive guard, instances.get() always returns
         a value when iterating instances.keys() -- @preserve */
      if (!cameraIDs?.size) {
        return;
      }
      const instanceQuery = { ...query, cameraIDs: cameraIDs };
      const cachedResult =
        (engineOptions?.useCache ?? true) ? this._requestCache.get(instanceQuery) : null;
      if (cachedResult) {
        output.set(instanceQuery, cachedResult as FrigateReviewQueryResults);
        return;
      }

      const severities = query.severity?.size ? Array.from(query.severity) : [undefined];

      // Frigate only supports querying for a single severity, so we generate
      // multiple queries and combine the results.
      const reviewPromises = severities
        // Frigate does not support a 'low' severity.
        .filter((severity) => severity !== 'low')
        .map((severity) => (!!severity ? FRIGATE_SEVERITY_MAP[severity] : undefined))
        .map(
          async (frigateSeverity) =>
            await getReviews(hass, {
              instance_id: instanceID,
              cameras: Array.from(
                this._getFrigateCameraNamesForCameraIDs(store, cameraIDs),
              ),
              ...(query.what && { labels: Array.from(query.what) }),
              ...(query.where && { zones: Array.from(query.where) }),
              ...(query.end && { before: Math.floor(query.end.getTime() / 1000) }),
              ...(query.start && { after: Math.floor(query.start.getTime() / 1000) }),
              ...(query.limit && { limit: query.limit }),
              severity: frigateSeverity,
              ...(query.reviewed !== undefined && { reviewed: query.reviewed }),
            }),
        );

      const result: FrigateReviewQueryResults = {
        type: QueryResultsType.Review,
        engine: Engine.Frigate,
        instanceID: instanceID,
        reviews: (await Promise.all(reviewPromises)).flat(),
        expiry: add(new Date(), { seconds: REVIEW_REQUEST_CACHE_MAX_AGE_SECONDS }),
        cached: false,
      };

      if (engineOptions?.useCache ?? true) {
        this._requestCache.set(
          instanceQuery,
          { ...result, cached: true },
          result.expiry,
        );
      }
      output.set(instanceQuery, result);
    };

    const instances = this._buildInstanceToCameraIDMapFromQuery(store, query.cameraIDs);

    await Promise.all(
      Array.from(instances.keys()).map((instanceID) =>
        processInstanceQuery(instanceID, instances.get(instanceID)),
      ),
    );
    return output.size ? output : null;
  }

  public async getRecordings(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: RecordingQuery,
    engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap | null> {
    if (hasUnsupportedFilters(query)) {
      return null;
    }

    const output: RecordingQueryResultsMap = new Map();

    const processQuery = async (
      baseQuery: RecordingQuery,
      cameraID: string,
    ): Promise<void> => {
      const query = { ...baseQuery, cameraIDs: new Set([cameraID]) };
      const cachedResult =
        (engineOptions?.useCache ?? true) ? this._requestCache.get(query) : null;
      if (cachedResult) {
        output.set(query, cachedResult as RecordingQueryResults);
        return;
      }

      const cameraConfig = this._getQueryableCameraConfig(store, cameraID);
      if (
        !cameraConfig ||
        !cameraConfig.frigate.camera_name ||
        !cameraConfig.frigate.client_id
      ) {
        return;
      }

      const recordingSummary = await getRecordingsSummary(
        hass,
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
      );

      let recordings: FrigateRecording[] = [];

      for (const dayData of recordingSummary ?? []) {
        for (const hourData of dayData.hours) {
          // The day and hour carry no timezone, so converting them to a point
          // in time needs to use the HA timezone, as the Frigate integration
          // returns the summary using that timezone.
          const startHour = hourInTimeZoneToDate(
            dayData.day,
            hourData.hour,
            hass.config.time_zone,
          );
          const endHour = endOfHourInTimeZone(startHour, hass.config.time_zone);
          // The query window and a recording hour can start on different
          // minutes, so an overlap counts.
          if (
            (!query.end || startHour <= query.end) &&
            (!query.start || endHour >= query.start)
          ) {
            recordings.push({
              cameraID: cameraID,
              startTime: startHour,
              endTime: endHour,
              events: hourData.events,
            });
          }
        }
      }

      if (query.limit !== undefined) {
        // Frigate does not natively support a way to limit recording searches so
        // this simulates it.
        recordings = orderBy(
          recordings,
          (recording: FrigateRecording) => recording.startTime,
          'desc',
        ).slice(0, query.limit);
      }

      const result: FrigateRecordingQueryResults = {
        type: QueryResultsType.Recording,
        engine: Engine.Frigate,
        instanceID: cameraConfig.frigate.client_id,
        recordings: recordings,
        expiry: add(new Date(), {
          seconds: RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS,
        }),
        cached: false,
      };
      if (engineOptions?.useCache ?? true) {
        this._requestCache.set(query, { ...result, cached: true }, result.expiry);
      }
      output.set(query, result);
    };

    // Frigate recordings can only be queried for a single camera, so fan out
    // the inbound query into multiple outbound queries.
    await Promise.all(
      Array.from(query.cameraIDs).map((cameraID) => processQuery(query, cameraID)),
    );
    return output.size ? output : null;
  }

  public async getRecordingSegments(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: RecordingSegmentsQuery,
    engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap | null> {
    const output: RecordingSegmentsQueryResultsMap = new Map();

    const processQuery = async (
      baseQuery: RecordingSegmentsQuery,
      cameraID: string,
    ): Promise<void> => {
      const query = { ...baseQuery, cameraIDs: new Set([cameraID]) };
      const cameraConfig = this._getQueryableCameraConfig(store, cameraID);
      if (
        !cameraConfig ||
        !cameraConfig.frigate.camera_name ||
        !cameraConfig.frigate.client_id
      ) {
        return;
      }

      const range: DateRange = { start: query.start, end: query.end };

      // A note on Frigate Recording Segments:
      // - There is an internal cache at the engine level for segments to allow
      //   caching "within an existing query" (e.g. if we already cached hour
      //   1-8, we will avoid a fetch if we request hours 2-3 even though the
      //   query is different -- the segments won't be). This is since the
      //   volume of data in segment transfers can be high, and the segments can
      //   be used in high frequency situations (e.g. video seeking).
      // - Each cached request then forgets segments outside the configured
      //   retention margin. Panning back within that margin stays a hit.
      //   Panning further away refetches instead of keeping every hour visited.
      const useCache = engineOptions?.useCache ?? true;
      const cachedSegments = useCache
        ? this._recordingSegmentsCache.get(cameraID, range)
        : null;
