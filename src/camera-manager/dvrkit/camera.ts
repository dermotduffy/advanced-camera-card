import type { HomeAssistant } from '../../ha/types';
import type { CapabilitiesRaw } from '../../types';
import { Camera, type CameraInitializationOptions } from '../camera';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';

export interface DvrkitCameraInfo {
  entry_id: string;
  channel: number;
  name: string;
  timezone: string;
}

export class DvrkitCamera extends Camera {
  private _info: DvrkitCameraInfo | null = null;

  public getInfo(): DvrkitCameraInfo | null {
    return this._info;
  }

  protected override async _initializeBeforeCapabilities(hass: HomeAssistant): Promise<void> {
    const entityID = getCameraEntityFromConfig(this.getConfig());
    if (entityID) {
      this._info = await hass.callWS<DvrkitCameraInfo>({
        type: 'dvrkit/camera/info',
        entity_id: entityID,
      });
    }
  }

  protected override async _getRawCapabilities(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<CapabilitiesRaw> {
    return {
      ...(await super._getRawCapabilities(hass, options)),
      recordings: !!this._info,
      seek: !!this._info,
    };
  }
}
