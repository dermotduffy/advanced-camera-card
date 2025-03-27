import { ActionsExecutor } from '../card-controller/actions/types';
import { StateWatcherSubscriptionInterface } from '../card-controller/hass/state-watcher';
import { PTZAction, PTZActionPhase } from '../config/schema/actions/custom/ptz';
import { CameraConfig } from '../config/schema/cameras';
import { localize } from '../localize/localize';
import { HassStateDifference, isTriggeredState } from '../utils/ha';
import { Capabilities } from './capabilities';
import { CameraManagerEngine } from './engine';
import { CameraNoIDError } from './error';
import { CameraEventCallback, CameraProxyConfig } from './types';
import { getConfiguredPTZAction } from './utils/ptz';

export interface CameraInitializationOptions {
  stateWatcher: StateWatcherSubscriptionInterface;
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
      capabilities?: Capabilities;
      eventCallback?: CameraEventCallback;
    },
  ) {
    this._config = config;
    this._engine = engine;
    this._capabilities = options?.capabilities;
    this._eventCallback = options?.eventCallback;
  }

  async initialize(options: CameraInitializationOptions): Promise<Camera> {
    if (this._capabilities?.has('trigger')) {
      options.stateWatcher.subscribe(
        this._stateChangeHandler,
        this._config.triggers.entities,
      );
    }
    this._onDestroy(() => options.stateWatcher.unsubscribe(this._stateChangeHandler));
    return this;
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

  public getProxyConfig(): CameraProxyConfig {
    return {
      dynamic: this._config.proxy.dynamic,
      media: this._config.proxy.media === 'auto' ? false : this._config.proxy.media,
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
}
