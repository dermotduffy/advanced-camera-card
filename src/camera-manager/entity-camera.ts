import { Entity, EntityRegistryManager } from '../ha/registry/entity/types';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import { Camera, CameraInitializationOptions } from './camera';
import { CameraInitializationError } from './error';
import { getCameraEntityFromConfig } from './utils/camera-entity-from-config';

export interface EntityCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  hass: HomeAssistant;
}

export class EntityCamera extends Camera {
  protected _entity: Entity | null = null;

  public async initialize(options: EntityCameraInitializationOptions): Promise<Camera> {
    const config = this.getConfig();
    const cameraEntityID = getCameraEntityFromConfig(config);
    const entity = cameraEntityID
      ? await options.entityRegistryManager.getEntity(options.hass, cameraEntityID)
      : null;

    if (!entity || !cameraEntityID) {
      throw new CameraInitializationError(localize('error.no_camera_entity'), config);
    }
    this._entity = entity;
    return await super.initialize(options);
  }

  public getEntity(): Entity | null {
    return this._entity;
  }
}
