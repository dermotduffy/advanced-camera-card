import { HomeAssistant } from '../ha/types';
import { Camera, CameraInitializationOptions } from './camera';
import { CameraNoEntityError } from './error';

/**
 * Camera variant that requires a `camera_entity` to be present in the HA
 * entity registry. Base `Camera` resolves `_entity` opportunistically; this
 * subclass turns absence into an error for engines that cannot function
 * without it (motionEye, Reolink, TPLink).
 */
export class EntityCamera extends Camera {
  protected override async _initialize(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<void> {
    if (!this._entity) {
      throw new CameraNoEntityError(this.getConfig());
    }
    await super._initialize(hass, options);
  }
}
