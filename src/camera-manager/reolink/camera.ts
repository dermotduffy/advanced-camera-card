import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { EntityRegistryManager } from '../../utils/ha/registry/entity';
import { BrowseMediaCamera } from '../browse-media/camera';
import { Camera, CameraInitializationOptions } from '../camera';
import { CameraInitializationError } from '../error';
import { CameraProxyConfig } from '../types';

interface ReolinkCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  hass: HomeAssistant;
}

class ReolinkInitializationError extends CameraInitializationError {}

export class ReolinkCamera extends BrowseMediaCamera {
  protected _channel: number | null = null;

  public async initialize(options: ReolinkCameraInitializationOptions): Promise<Camera> {
    await super.initialize(options);
    this._initializeChannel();
    return this;
  }

  protected _initializeChannel(): void {
    const uniqueID = this._entity?.unique_id;
    const match = uniqueID ? String(uniqueID).match(/(.*)_(?<channel>\d+)/) : null;
    const channel = match && match.groups?.channel ? Number(match.groups.channel) : null;

    if (channel === null) {
      throw new ReolinkInitializationError(
        localize('error.camera_initialization_reolink'),
        this.getConfig(),
      );
    }
    this._channel = channel;
  }

  public getChannel(): number | null {
    return this._channel;
  }

  public getProxyConfig(): CameraProxyConfig {
    return {
      ...super.getProxyConfig(),

      // For reolink, media is always proxied unless explicitly turned off.
      media: this._config.proxy.media === 'auto' ? true : this._config.proxy.media,

      // Reolink does not verify SSL certificates since they may be self-signed.
      ssl_verification:
        this._config.proxy.ssl_verification === 'auto'
          ? false
          : this._config.proxy.ssl_verification,

      // Through experimentation 'intermediate' is the "highest
      // lowest-common-denominator" Reolink devices appear to support.
      ssl_ciphers:
        this._config.proxy.ssl_ciphers === 'auto'
          ? 'intermediate'
          : this._config.proxy.ssl_ciphers,
    };
  }
}
