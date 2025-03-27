import { CameraConfig } from '../config/schema/cameras';
import { HomeAssistant } from '../ha/types';
import { ViewMedia } from '../view/media';
import { Camera } from './camera';
import { CameraManagerReadOnlyConfigStore } from './store';
import {
  CameraEndpoint,
  CameraEndpoints,
  CameraEndpointsContext,
  CameraManagerCameraMetadata,
  CameraManagerMediaCapabilities,
  DataQuery,
  Engine,
  EngineOptions,
  EventQuery,
  EventQueryResultsMap,
  MediaMetadataQuery,
  MediaMetadataQueryResultsMap,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryReturnType,
  RecordingQuery,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResultsMap,
} from './types';

export const CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT = 10000;

export interface CameraManagerEngine {
  getEngineType(): Engine;

  createCamera(hass: HomeAssistant, cameraConfig: CameraConfig): Promise<Camera>;

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

  getMediaDownloadPath(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
  ): Promise<CameraEndpoint | null>;

  favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void>;

  getQueryResultMaxAge(query: DataQuery): number | null;

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

  getMediaCapabilities(media: ViewMedia): CameraManagerMediaCapabilities | null;

  getCameraEndpoints(
    cameraConfig: CameraConfig,
    context?: CameraEndpointsContext,
  ): CameraEndpoints | null;
}
