import { ActionsExecutor } from '../card-controller/actions/types';
import { StateWatcherSubscriptionInterface } from '../card-controller/hass/state-watcher';
import { PTZAction, PTZActionPhase } from '../config/schema/actions/custom/ptz';
import { CameraConfig } from '../config/schema/cameras';
import { isTriggeredState } from '../ha/is-triggered-state';
import { HassStateDifference, HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import { CapabilitiesRaw, CapabilityKey, Endpoint } from '../types';
import { liveProviderSupports2WayAudio } from '../utils/live-provider';
import { Capabilities } from './capabilities';
import { CameraManagerEngine } from './engine';
import { CameraNoIDError } from './error';
import {
  CameraEndpoints,
  CameraEndpointsContext,
  CameraEventCallback,
  CameraProxyConfig,
} from './types';
import {
  getGo2RTCMetadataEndpoint,
  getGo2RTCStreamEndpoint,
} from './utils/go2rtc/endpoint';
import { getConfiguredPTZAction } from './utils/ptz';

interface CapabilityOptions {
  // Pre-built Capabilities object.
  capabilities?: Capabilities;

  // Raw capabilities for construction.
  raw?: CapabilitiesRaw;
  disable?: CapabilityKey[];
  disableExcept?: CapabilityKey[];
}

export interface CameraInitializationOptions {
  hass: HomeAssistant;
  stateWatcher: StateWatcherSubscriptionInterface;
  capabilityOptions?: CapabilityOptions;
}

type DestroyCallback = () => void | Promise<void>;

export class Camera {
  protected _config: CameraConfig;
  protected _engine: CameraManagerEngine;
  protected _capabilities?: Capabilities;
  protected _eventCallback?: CameraEventCallback;
  protected _destroyCallbacks: DestroyCallback[] = [];

  constructor(
    config: CameraConfig,
    engine: CameraManagerEngine,
    options?: {
      eventCallback?: CameraEventCallback;
      capabilities?: Capabilities;
    },
  ) {
    this._config = config;
    this._engine = engine;
    this._eventCallback = options?.eventCallback;
    this._capabilities = options?.capabilities;
  }

  async initialize(options: CameraInitializationOptions): Promise<Camera> {
    await this._initialize(options);
    this._capabilities =
      options.capabilityOptions?.capabilities ??
      this._capabilities ??
      (await this._buildCapabilities(options));
    this._subscribeBasedOnCapabilities(options.stateWatcher);
    this._onDestroy(() => options.stateWatcher.unsubscribe(this._stateChangeHandler));
    return this;
  }

  /**
   * Subclass initialization hook. Override for async initialization work.
   */
  protected async _initialize(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: CameraInitializationOptions,
  ): Promise<void> {}

  protected async _buildCapabilities(
    options: CameraInitializationOptions,
  ): Promise<Capabilities> {
    const rawCapabilities = await this._getRawCapabilities(options);
    const config = this.getConfig();
    const has2WayAudio = await liveProviderSupports2WayAudio(
      options.hass,
      config,
      this._getGo2RTCMetadataEndpoint(),
      this.getProxyConfig(),
    );

    return new Capabilities(
      { ...rawCapabilities, '2-way-audio': has2WayAudio },
      {
        disable: config.capabilities?.disable,
        disableExcept: config.capabilities?.disable_except,
      },
    );
  }

  /**
   * Get raw capabilities for this camera. Subclasses should override
   * and call super._getRawCapabilities() to extend defaults.
   */
  protected async _getRawCapabilities(
    options: CameraInitializationOptions,
  ): Promise<CapabilitiesRaw> {
    return {
      live: true,
      menu: true,
      substream: true,
      trigger: true,
      'remote-control-entity': true,
      ...options.capabilityOptions?.raw,
    };
  }

  public async destroy(): Promise<void> {
    this._destroyCallbacks.forEach((callback) => callback());
  }

  public getConfig(): CameraConfig {
    return this._config;
  }

  public setID(cameraID: string): void {
    this._config.id = cameraID;
  }

  public getID(): string {
    if (this._config.id) {
      return this._config.id;
    }
    throw new CameraNoIDError(localize('error.no_camera_id'));
  }

  public getEngine(): CameraManagerEngine {
    return this._engine;
  }

  public getCapabilities(): Capabilities | null {
    return this._capabilities ?? null;
  }

  /**
   * Get camera endpoints. Subclasses should override to add engine-specific endpoints.
   * @param _context Optional context for dynamic endpoints (e.g., UI URLs based on current view).
   */
  public getEndpoints(context?: CameraEndpointsContext): CameraEndpoints | null {
    const ui = this._getUIEndpoint(context);
    const go2rtc = this._getGo2RTCStreamEndpoint();
    const webrtcCard = this._getWebRTCCardEndpoint();

    return ui || go2rtc || webrtcCard
      ? {
          ...(ui && { ui }),
          ...(go2rtc && { go2rtc }),
          ...(webrtcCard && { webrtcCard }),
        }
      : null;
  }

  /**
   * Get the go2rtc metadata endpoint for capability detection.
   * Subclasses should override if they have custom go2rtc URL or stream resolution.
   */
  protected _getGo2RTCMetadataEndpoint(): Endpoint | null {
    return getGo2RTCMetadataEndpoint(this._config);
  }

  protected _getGo2RTCStreamEndpoint(): Endpoint | null {
    return getGo2RTCStreamEndpoint(this._config);
  }

  protected _getWebRTCCardEndpoint(): Endpoint | null {
    return this._config.camera_entity ? { endpoint: this._config.camera_entity } : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _getUIEndpoint(_context?: CameraEndpointsContext): Endpoint | null {
    return null;
  }

  public getProxyConfig(): CameraProxyConfig {
    return {
      live:
        this._config.proxy.live === 'auto'
          ? // Live is proxied if the live provider is go2rtc and if a go2rtc
            // URL is manually set.
            this._config.live_provider === 'go2rtc' && !!this._config.go2rtc?.url
          : this._config.proxy.live,
      media: this._config.proxy.media === 'auto' ? false : this._config.proxy.media,

      dynamic: this._config.proxy.dynamic,
      ssl_verification: this._config.proxy.ssl_verification !== false,
      ssl_ciphers:
        this._config.proxy.ssl_ciphers === 'auto'
          ? 'default'
          : this._config.proxy.ssl_ciphers,
    };
  }

  public async executePTZAction(
    executor: ActionsExecutor,
    action: PTZAction,
    options?: {
      phase?: PTZActionPhase;
      preset?: string;
    },
  ): Promise<boolean> {
    const configuredAction = getConfiguredPTZAction(this.getConfig(), action, options);
    if (configuredAction) {
      await executor.executeActions({ actions: configuredAction });
      return true;
    }
    return false;
  }

  protected _stateChangeHandler = (difference: HassStateDifference): void => {
    this._eventCallback?.({
      cameraID: this.getID(),
      type: isTriggeredState(difference.newState.state) ? 'new' : 'end',
    });
  };

  protected _onDestroy(callback: DestroyCallback): void {
    this._destroyCallbacks.push(callback);
  }

  protected _subscribeBasedOnCapabilities(
    stateWatcher: StateWatcherSubscriptionInterface,
  ): void {
    if (this._capabilities?.has('trigger')) {
      stateWatcher.unsubscribe(this._stateChangeHandler);
      stateWatcher.subscribe(this._stateChangeHandler, this._config.triggers.entities);
    }
  }
}
