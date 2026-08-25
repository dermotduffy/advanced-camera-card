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
  // TPLink cameras require a registry manager to resolve their PTZ entities,
  // which the constructor below guarantees; the base engine only optionally
  // has one.
  protected declare _entityRegistryManager: EntityRegistryManager;

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

  public createCamera(cameraConfig: CameraConfig): Camera {
    return new TPLinkCamera(
      cameraConfig,
      this,
      {
        hassManager: this._hassManager,
        entityRegistryManager: this._entityRegistryManager,
      },
      { eventCallback: this._eventCallback },
    );
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    camera: Camera,
  ): CameraManagerCameraMetadata {
    return {
      ...super.getCameraMetadata(hass, camera),
      engineIcon: 'tplink',
    };
  }
}
