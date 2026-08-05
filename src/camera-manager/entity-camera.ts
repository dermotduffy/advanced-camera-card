import type { HomeAssistant } from '../ha/types';
import { Camera, type CameraInitializationOptions } from './camera';
import { CameraNoEntityError } from './error';

/**
 * Camera variant that requires a `camera_entity` to be present in the HA
 * entity registry. Base `Camera` resolves `_entity` opportunistically; this
 * subclass turns absence into an error for engines that cannot function
 * without it (motionEye, Reolink, TPLink).
 */
export class EntityCamera<
  Options extends CameraInitializationOptions = CameraInitializationOptions,
> extends Camera<Options> {
  protected override async _initializeBeforeCapabilities(
    hass: HomeAssistant,
    options: Options,
  ): Promise<void> {
    if (!this._entity) {
      throw new CameraNoEntityError(this.getConfig());
    }
    await super._initializeBeforeCapabilities(hass, options);
  }
}
