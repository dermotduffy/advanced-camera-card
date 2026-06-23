import { HomeAssistant } from '../../ha/types';
import { CapabilitiesRaw, Endpoint } from '../../types';
import { CameraInitializationOptions } from '../camera';
import { EntityCamera } from '../entity-camera';
import { CameraEndpointsContext, CameraProxyConfig } from '../types';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';

export class MotionEyeCamera extends EntityCamera {
  public getProxyConfig(): CameraProxyConfig {
    return {
      ...super.getProxyConfig(),

      // For motionEye, media is always proxied unless explicitly turned off.
      media: this._config.proxy.media === 'auto' ? true : this._config.proxy.media,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected override _getUIEndpoint(_context?: CameraEndpointsContext): Endpoint | null {
    return this._config.motioneye?.url ? { endpoint: this._config.motioneye.url } : null;
  }

  protected async _getRawCapabilities(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<CapabilitiesRaw> {
    const ptz = getPTZCapabilitiesFromCameraConfig(this.getConfig());

    return {
      ...(await super._getRawCapabilities(hass, options)),
      clips: true,
      snapshots: true,
      ...(ptz && { ptz }),
    };
  }
}
