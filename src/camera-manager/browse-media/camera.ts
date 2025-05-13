import { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { Camera, CameraInitializationOptions } from '../camera';
import { CameraInitializationError } from '../error';

interface BrowseMediaCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  hass: HomeAssistant;
}

export class BrowseMediaCamera extends Camera {
  protected _entity: Entity | null = null;

  public async initialize(
    options: BrowseMediaCameraInitializationOptions,
  ): Promise<Camera> {
    const config = this.getConfig();
    const entity = config.camera_entity
      ? await options.entityRegistryManager.getEntity(options.hass, config.camera_entity)
      : null;

    if (!entity || !config.camera_entity) {
      throw new CameraInitializationError(localize('error.no_camera_entity'), config);
    }
    this._entity = entity;
    return await super.initialize(options);
  }

  public getEntity(): Entity | null {
    return this._entity;
  }
}
