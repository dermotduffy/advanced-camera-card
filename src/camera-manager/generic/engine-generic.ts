/* eslint-disable @typescript-eslint/no-unused-vars */

import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { CameraConfig } from '../../config/schema/cameras';
import { getEntityTitle } from '../../ha/get-entity-title';
import { HomeAssistant } from '../../ha/types';
import { Endpoint } from '../../types';
import { ViewMedia } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';
import { Camera } from '../camera';
import { CameraManagerEngine } from '../engine';
import { CameraManagerReadOnlyConfigStore } from '../store';
import {
  CameraEventCallback,
  CameraManagerCameraMetadata,
  CameraQuery,
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
  RecordingQuery,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResultsMap,
  ReviewQuery,
  ReviewQueryResultsMap,
} from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';

export class GenericCameraManagerEngine implements CameraManagerEngine {
  protected _eventCallback?: CameraEventCallback;
  protected _stateWatcher: StateWatcherSubscriptionInterface;

  constructor(
    stateWatcher: StateWatcherSubscriptionInterface,
    eventCallback?: CameraEventCallback,
  ) {
    this._stateWatcher = stateWatcher;
    this._eventCallback = eventCallback;
  }

  public getEngineType(): Engine {
    return Engine.Generic;
  }

  public async createCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<Camera> {
    return await new Camera(cameraConfig, this, {
      eventCallback: this._eventCallback,
    }).initialize({
      hass,
      stateWatcher: this._stateWatcher,
      capabilityOptions: {
        raw: {
          ptz: getPTZCapabilitiesFromCameraConfig(cameraConfig) ?? undefined,
        },
        disable: cameraConfig.capabilities?.disable,
        disableExcept: cameraConfig.capabilities?.disable_except,
      },
    });
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
    _cameraConfig: CameraConfig,
    _media: ViewMedia,
  ): Promise<Endpoint | null> {
    return null;
  }

  public async favoriteMedia(
    _hass: HomeAssistant,
    _cameraConfig: CameraConfig,
    _media: ViewMedia,
    _favorite: boolean,
  ): Promise<void> {
    return;
  }

  public async reviewMedia(
    _hass: HomeAssistant,
    _cameraConfig: CameraConfig,
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
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata {
    const cameraEntity = getCameraEntityFromConfig(cameraConfig);
    return {
      title:
        cameraConfig.title ??
        getEntityTitle(hass, cameraConfig.camera_entity) ??
        getEntityTitle(hass, cameraConfig.webrtc_card?.entity) ??
        cameraConfig.id ??
        '',
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
