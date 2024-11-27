import { BrowseMediaCamera } from '../browse-media/camera';
import { CameraProxyConfig } from '../types';

export class MotionEyeCamera extends BrowseMediaCamera {
  public getProxyConfig(): CameraProxyConfig {
    return {
      ...super.getProxyConfig(),

      // For motionEye, media is always proxied unless explicitly turned off.
      media: this._config.proxy.media === 'auto' ? true : this._config.proxy.media,
    };
  }
}
