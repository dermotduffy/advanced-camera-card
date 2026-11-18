import type { CapabilitiesRaw, Endpoint } from '../../types';
import { EntityCamera } from '../entity-camera';
import type { CameraEndpointsContext, CameraProxyConfig } from '../types';

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

  protected override _deriveConfiguredCapabilities(): CapabilitiesRaw {
    return {
      ...super._deriveConfiguredCapabilities(),
      clips: true,
      snapshots: true,
    };
  }
}
