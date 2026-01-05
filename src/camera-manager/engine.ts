import { CameraConfig } from '../config/schema/cameras';
import { HomeAssistant } from '../ha/types';
import { Endpoint } from '../types';
import { ViewMedia } from '../view/item';
import { ViewItemCapabilities } from '../view/types';
import { Camera } from './camera';
import { CameraManagerReadOnlyConfigStore } from './store';
import {
  CameraManagerCameraMetadata,
  CameraQuery,
  DefaultQueryParameters,
  Engine,
  EngineOptions,
  EventQuery,
  EventQueryResultsMap,
  MediaMetadataQuery,
  MediaMetadataQueryResultsMap,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  PartialReviewQuery,
  QueryReturnType,
  QueryType,
  RecordingQuery,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResultsMap,
  ReviewQuery,
  ReviewQueryResultsMap,
} from './types';

export const CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT = 10000;

export interface CameraManagerEngine {
  getEngineType(): Engine;

  createCamera(hass: HomeAssistant, cameraConfig: CameraConfig): Promise<Camera>;

  /**
   * Get default query parameters for a camera based on its configuration.
   * Engines read their own config and return generic filter params.
   */
  getDefaultQueryParameters(
    camera: Camera,
    queryType: QueryType,
  ): DefaultQueryParameters;

  generateDefaultEventQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null;

  generateDefaultRecordingQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialRecordingQuery,
  ): RecordingQuery[] | null;

  generateDefaultRecordingSegmentsQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null;

  getEvents(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: EventQuery,
    engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap | null>;

  getRecordings(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: RecordingQuery,
    engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap | null>;

  getRecordingSegments(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: RecordingSegmentsQuery,
    engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap | null>;

  generateDefaultReviewQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query?: PartialReviewQuery,
  ): ReviewQuery[] | null;

  getReviews(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: ReviewQuery,
    engineOptions?: EngineOptions,
  ): Promise<ReviewQueryResultsMap | null>;

  generateMediaFromEvents(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null;

  generateMediaFromRecordings(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: RecordingQuery,
    results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null;

  generateMediaFromReviews(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: ReviewQuery,
    results: QueryReturnType<ReviewQuery>,
  ): ViewMedia[] | null;

  getMediaDownloadPath(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
  ): Promise<Endpoint | null>;

  favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void>;

  reviewMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    reviewed: boolean,
  ): Promise<void>;

  getQueryResultMaxAge(query: CameraQuery): number | null;

  getMediaSeekTime(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    media: ViewMedia,
    target: Date,
    engineOptions?: EngineOptions,
  ): Promise<number | null>;

  getMediaMetadata(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: MediaMetadataQuery,
    engineOptions?: EngineOptions,
  ): Promise<MediaMetadataQueryResultsMap | null>;

  getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata;

  getMediaCapabilities(media: ViewMedia): ViewItemCapabilities | null;
}
