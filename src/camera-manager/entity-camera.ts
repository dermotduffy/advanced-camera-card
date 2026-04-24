import { Entity, EntityRegistryManager } from '../ha/registry/entity/types';
import { Camera, CameraInitializationOptions } from './camera';
import { CameraNoEntityError } from './error';
import { getCameraEntityFromConfig } from './utils/camera-entity-from-config';

export interface EntityCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
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
      throw new CameraNoEntityError(config);
    }
    this._entity = entity;
    return await super.initialize(options);
  }

  public getEntity(): Entity | null {
    return this._entity;
  }
}
