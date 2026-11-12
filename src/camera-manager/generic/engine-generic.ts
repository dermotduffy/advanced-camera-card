/* eslint-disable @typescript-eslint/no-unused-vars */

import type { HASSManagerReadonlyInterface } from '../../card-controller/hass/types';
import type { CameraConfig } from '../../config/schema/cameras';
import { getEntityTitle } from '../../ha/get-entity-title';
import type { EntityRegistryManager } from '../../ha/registry/entity/types';
import type { HomeAssistant } from '../../ha/types';
import type { Endpoint } from '../../types';
import type { ViewMedia } from '../../view/item';
import type { ViewItemCapabilities } from '../../view/types';
import { Camera } from '../camera';
import type { CameraManagerEngine } from '../engine';
import type { CameraManagerReadOnlyConfigStore } from '../store';
import {
  Engine,
  type CameraEventCallback,
  type CameraManagerCameraMetadata,
  type CameraQuery,
  type DefaultQueryParameters,
  type EngineOptions,
  type EventQuery,
  type EventQueryResultsMap,
  type MediaMetadataQuery,
  type MediaMetadataQueryResultsMap,
  type PartialEventQuery,
  type PartialRecordingQuery,
  type PartialRecordingSegmentsQuery,
  type PartialReviewQuery,
  type QueryReturnType,
  type QueryType,
  type RecordingQuery,
  type RecordingQueryResultsMap,
  type RecordingSegmentsQuery,
  type RecordingSegmentsQueryResultsMap,
  type ReviewQuery,
  type ReviewQueryResultsMap,
} from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';

export class GenericCameraManagerEngine implements CameraManagerEngine {
  protected _eventCallback?: CameraEventCallback;
  protected _hassManager: HASSManagerReadonlyInterface;
  protected _entityRegistryManager?: EntityRegistryManager;

  constructor(
    hassManager: HASSManagerReadonlyInterface,
    entityRegistryManager?: EntityRegistryManager,
    eventCallback?: CameraEventCallback,
  ) {
    this._hassManager = hassManager;
    this._entityRegistryManager = entityRegistryManager;
    this._eventCallback = eventCallback;
  }

  public getEngineType(): Engine {
    return Engine.Generic;
  }

  public createCamera(cameraConfig: CameraConfig): Camera {
    return new Camera(
      cameraConfig,
      this,
      {
        hassManager: this._hassManager,
        entityRegistryManager: this._entityRegistryManager,
      },
      {
        eventCallback: this._eventCallback,
      },
    );
  }

  public getDefaultQueryParameters(
    _camera: Camera,
    _queryType: QueryType,
  ): DefaultQueryParameters {
    return {};
  }

  public generateDefaultEventQuery(
    _store: CameraManagerReadOnlyConfigStore,
    _cameraIDs: Set<string>,
    _query: PartialEventQuery,
  ): EventQuery[] | null {
    return null;
  }

  public generateDefaultRecordingQuery(
    _store: CameraManagerReadOnlyConfigStore,
    _cameraIDs: Set<string>,
    _query: PartialRecordingQuery,
  ): RecordingQuery[] | null {
    return null;
  }

  public generateDefaultRecordingSegmentsQuery(
    _store: CameraManagerReadOnlyConfigStore,
    _cameraIDs: Set<string>,
    _query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    return null;
  }

  public async getEvents(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: EventQuery,
    _engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap | null> {
    return null;
  }

  public async getRecordings(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: RecordingQuery,
    _engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap | null> {
    return null;
  }

  public async getRecordingSegments(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: RecordingSegmentsQuery,
    _engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap | null> {
    return null;
  }

  public generateDefaultReviewQuery(
    _store: CameraManagerReadOnlyConfigStore,
    _cameraIDs: Set<string>,
    _query?: PartialReviewQuery,
  ): ReviewQuery[] | null {
    return null;
  }

  public async getReviews(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: ReviewQuery,
    _engineOptions?: EngineOptions,
  ): Promise<ReviewQueryResultsMap | null> {
    return null;
  }

  public generateMediaFromEvents(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: EventQuery,
    _results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null {
    return null;
  }

  public generateMediaFromRecordings(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: RecordingQuery,
    _results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null {
    return null;
  }

  public generateMediaFromReviews(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: ReviewQuery,
    _results: QueryReturnType<ReviewQuery>,
  ): ViewMedia[] | null {
    return null;
  }

  public async getMediaDownloadPath(
    _hass: HomeAssistant,
    _camera: Camera,
    _media: ViewMedia,
  ): Promise<Endpoint | null> {
    return null;
  }

  public async favoriteMedia(
    _hass: HomeAssistant,
    _camera: Camera,
    _media: ViewMedia,
    _favorite: boolean,
  ): Promise<void> {
    return;
  }

  public async reviewMedia(
    _hass: HomeAssistant,
    _camera: Camera,
    _media: ViewMedia,
    _reviewed: boolean,
  ): Promise<void> {
    return;
  }

  public getQueryResultMaxAge(_query: CameraQuery): number | null {
    return null;
  }

  public async getMediaSeekTime(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _media: ViewMedia,
    _target: Date,
    _engineOptions?: EngineOptions,
  ): Promise<number | null> {
    return null;
  }

  public async getMediaMetadata(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: MediaMetadataQuery,
    _engineOptions?: EngineOptions,
  ): Promise<MediaMetadataQueryResultsMap | null> {
    return null;
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    camera: Camera,
  ): CameraManagerCameraMetadata {
    const cameraConfig = camera.getConfig();
    const cameraEntity = getCameraEntityFromConfig(cameraConfig);
    return {
      title:
        cameraConfig.title ??
        getEntityTitle(hass, cameraConfig.camera_entity) ??
        getEntityTitle(hass, cameraConfig.webrtc_card?.entity) ??
        camera.getID(),
      icon: {
        entity: cameraEntity ?? undefined,
        icon: cameraConfig.icon,
        fallback: 'mdi:video',
      },
    };
  }

  public getMediaCapabilities(_media: ViewMedia): ViewItemCapabilities | null {
    return null;
  }
}
