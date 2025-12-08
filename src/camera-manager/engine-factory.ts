import { StateWatcherSubscriptionInterface } from '../card-controller/hass/state-watcher';
import { CameraConfig } from '../config/schema/cameras';
import { BrowseMediaWalker } from '../ha/browse-media/walker';
import { EntityRegistryManager } from '../ha/registry/entity/types';
import { ResolvedMediaCache } from '../ha/resolved-media';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import { RecordingSegmentsCache } from './cache';
import { CameraManagerEngine } from './engine';
import { CameraInitializationError } from './error';
import { CameraEventCallback, CameraManagerRequestCache, Engine } from './types';
import { getCameraEntityFromConfig } from './utils/camera-entity-from-config';

interface CameraManagerEngineFactoryOptions {
  stateWatcher: StateWatcherSubscriptionInterface;
  resolvedMediaCache: ResolvedMediaCache;
  eventCallback?: CameraEventCallback;
}

export class CameraManagerEngineFactory {
  // Entity registry manager is required for the actual function of the factory.
  protected _entityRegistryManager: EntityRegistryManager;

  constructor(entityRegistryManager: EntityRegistryManager) {
    this._entityRegistryManager = entityRegistryManager;
  }

  public async createEngine(
    engine: Engine,
    options: CameraManagerEngineFactoryOptions,
  ): Promise<CameraManagerEngine> {
    let cameraManagerEngine: CameraManagerEngine;
    switch (engine) {
      case Engine.Generic:
        const { GenericCameraManagerEngine } = await import('./generic/engine-generic');
        cameraManagerEngine = new GenericCameraManagerEngine(
          options.stateWatcher,
          options.eventCallback,
        );
        break;
      case Engine.Frigate:
        const { FrigateCameraManagerEngine } = await import('./frigate/engine-frigate');
        cameraManagerEngine = new FrigateCameraManagerEngine(
          this._entityRegistryManager,
          options.stateWatcher,
          new RecordingSegmentsCache(),
          new CameraManagerRequestCache(),
          options.eventCallback,
        );
        break;
      case Engine.MotionEye:
        const { MotionEyeCameraManagerEngine } = await import(
          './motioneye/engine-motioneye'
        );
        cameraManagerEngine = new MotionEyeCameraManagerEngine(
          this._entityRegistryManager,
          options.stateWatcher,
          new BrowseMediaWalker(),
          options.resolvedMediaCache,
          new CameraManagerRequestCache(),
          options.eventCallback,
        );
        break;
      case Engine.Reolink:
        const { ReolinkCameraManagerEngine } = await import('./reolink/engine-reolink');
        cameraManagerEngine = new ReolinkCameraManagerEngine(
          this._entityRegistryManager,
          options.stateWatcher,
          new BrowseMediaWalker(),
          options.resolvedMediaCache,
          new CameraManagerRequestCache(),
          options.eventCallback,
        );
        break;
      case Engine.TPLink:
        const { TPLinkCameraManagerEngine } = await import('./tplink/engine-tplink');
        cameraManagerEngine = new TPLinkCameraManagerEngine(
          this._entityRegistryManager,
          options.stateWatcher,
          options.eventCallback,
        );
        break;
    }
    return cameraManagerEngine;
  }

  public async getEngineForCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<Engine | null> {
    let engine: Engine | null = null;
    if (cameraConfig.engine === 'frigate') {
      engine = Engine.Frigate;
    } else if (cameraConfig.engine === 'motioneye') {
      engine = Engine.MotionEye;
    } else if (cameraConfig.engine === 'generic') {
      engine = Engine.Generic;
    } else if (cameraConfig.engine === 'reolink') {
      engine = Engine.Reolink;
    } else if (cameraConfig.engine === 'tplink') {
      engine = Engine.TPLink;
    } else {
      const cameraEntity = getCameraEntityFromConfig(cameraConfig);

      if (cameraEntity) {
        const entity = await this._entityRegistryManager.getEntity(hass, cameraEntity);
        if (!entity) {
          // If the camera is not in the registry, but is in the HA states it is
          // assumed to be a generic camera.
          if (hass.states[cameraEntity]) {
            return Engine.Generic;
          }
          // Otherwise, it's probably a typo so throw an exception.
          throw new CameraInitializationError(
            localize('error.no_camera_entity'),
            cameraConfig,
          );
        }

        switch (entity?.platform) {
          case 'frigate':
            engine = Engine.Frigate;
            break;
          case 'motioneye':
            engine = Engine.MotionEye;
            break;
          case 'reolink':
            engine = Engine.Reolink;
            break;
          case 'tplink':
            engine = Engine.TPLink;
            break;
          default:
            engine = Engine.Generic;
        }
      } else if (cameraConfig.frigate.camera_name) {
        // Frigate technically does not need an entity, if the camera name is
        // manually set the camera is assumed to be Frigate.
        engine = Engine.Frigate;
      } else if (
        cameraConfig.webrtc_card?.url ||
        (cameraConfig.go2rtc?.url && cameraConfig.go2rtc?.stream)
      ) {
        engine = Engine.Generic;
      }
    }

    return engine;
  }
}
