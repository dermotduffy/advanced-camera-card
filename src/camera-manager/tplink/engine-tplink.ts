import type { HASSManagerReadonlyInterface } from '../../card-controller/hass/types';
import type { CameraConfig } from '../../config/schema/cameras';
import type { EntityRegistryManager } from '../../ha/registry/entity/types';
import type { HomeAssistant } from '../../ha/types';
import type { Camera } from '../camera';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import {
  Engine,
  type CameraEventCallback,
  type CameraManagerCameraMetadata,
} from '../types';
import { TPLinkCamera } from './camera';

export class TPLinkCameraManagerEngine extends GenericCameraManagerEngine {
  constructor(
    entityRegistryManager: EntityRegistryManager,
    hassManager: HASSManagerReadonlyInterface,
    eventCallback?: CameraEventCallback,
  ) {
    super(hassManager, entityRegistryManager, eventCallback);
    this._entityRegistryManager = entityRegistryManager;
  }

  public getEngineType(): Engine {
    return Engine.TPLink;
  }

  public async createCamera(cameraConfig: CameraConfig): Promise<Camera> {
    const camera = new TPLinkCamera(cameraConfig, this, {
      eventCallback: this._eventCallback,
    });
    return await camera.initialize({
      hassManager: this._hassManager,
      entityRegistryManager: this._entityRegistryManager,
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
