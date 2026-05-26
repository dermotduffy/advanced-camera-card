import { EventWatcherSubscriptionInterface } from '../../card-controller/hass/event-watcher';
import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { CameraConfig } from '../../config/schema/cameras';
import { EntityRegistryManager } from '../../ha/registry/entity/types';
import { HomeAssistant } from '../../ha/types';
import { Camera } from '../camera';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import { CameraEventCallback, CameraManagerCameraMetadata, Engine } from '../types';
import { TPLinkCamera } from './camera';

export class TPLinkCameraManagerEngine extends GenericCameraManagerEngine {
  constructor(
    entityRegistryManager: EntityRegistryManager,
    stateWatcher: StateWatcherSubscriptionInterface,
    eventWatcher: EventWatcherSubscriptionInterface,
    eventCallback?: CameraEventCallback,
  ) {
    super(stateWatcher, eventWatcher, entityRegistryManager, eventCallback);
    this._entityRegistryManager = entityRegistryManager;
  }

  public getEngineType(): Engine {
    return Engine.TPLink;
  }

  public async createCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<Camera> {
    const camera = new TPLinkCamera(cameraConfig, this, {
      eventCallback: this._eventCallback,
    });
    return await camera.initialize({
      entityRegistryManager: this._entityRegistryManager,
      hass,
      stateWatcher: this._stateWatcher,
      eventWatcher: this._eventWatcher,
    });
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata {
    return {
      ...super.getCameraMetadata(hass, cameraConfig),
      engineIcon: 'tplink',
    };
  }
}
