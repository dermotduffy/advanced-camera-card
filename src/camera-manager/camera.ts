import { uniq } from 'lodash-es';

import type { ActionsExecutor } from '../card-controller/actions/types';
import type { EventSubscriptionRequest } from '../card-controller/hass/event-watcher';
import type { HASSManagerReadonlyInterface } from '../card-controller/hass/types';
import type { PTZAction, PTZActionPhase } from '../config/schema/actions/custom/ptz';
import type { CameraConfig } from '../config/schema/cameras';
import type { HAEvent } from '../config/schema/common/ha-event';
import {
  resolveProxyConfig,
  type EnabledProxyConfig,
} from '../config/schema/common/proxy';
import { computeDomain } from '../ha/compute-domain';
import { matchesEventContext, matchesEventData } from '../ha/event-match';
import { getTriggerEventType } from '../ha/get-trigger-event-type';
import type { Entity, EntityRegistryManager } from '../ha/registry/entity/types';
import type { HassStateDifference, HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import type { CapabilitiesRaw, CapabilityKey, Endpoint } from '../types';
import { arrayify } from '../utils/basic';
import { liveProviderSupports2WayAudio } from '../utils/live-provider';
import { Capabilities } from './capabilities';
import type { CameraManagerEngine } from './engine';
import { CameraNoIDError } from './error';
import type {
  CameraEndpoints,
  CameraEndpointsContext,
  CameraEventCallback,
  CameraProxyConfig,
} from './types';
import { getCameraEntityFromConfig } from './utils/camera-entity-from-config';
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
  hassManager: HASSManagerReadonlyInterface;
  capabilityOptions?: CapabilityOptions;
  entityRegistryManager?: EntityRegistryManager;
}

type DestroyCallback = () => void | Promise<void>;

export class Camera {
  protected _config: CameraConfig;
  protected _engine: CameraManagerEngine;
  protected _capabilities?: Capabilities;
  protected _eventCallback?: CameraEventCallback;
  protected _destroyCallbacks: DestroyCallback[] = [];
  protected _entity: Entity | null = null;
  protected _initialized = false;

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

  public getEntity(): Entity | null {
    return this._entity;
  }

  public isInitialized(): boolean {
    return this._initialized;
  }

  async initialize(options: CameraInitializationOptions): Promise<Camera> {
    // Freeze a single HASS snapshot for the whole (async, multi-step)
    // initialization so every step observes a consistent entity world; live
    // subscriptions below still use the manager's current watchers.
    const hass = options.hassManager.getHASS();
    if (!hass) {
      return this;
    }

    this._entity = await this._resolveEntity(hass, options);
    await this._initialize(hass, options);

    this._capabilities =
      options.capabilityOptions?.capabilities ??
      this._capabilities ??
      (await this._buildCapabilities(hass, options));

    if (this._capabilities.has('trigger')) {
      await this._getTriggerEntities(hass, options);
      this._config.triggers.entities = uniq(this._config.triggers.entities);

      // Subscribe to state based triggers (sync; no race with destroy).
      const stateWatcher = options.hassManager.getStateWatcher();
      stateWatcher.subscribe(this._stateChangeHandler, this._config.triggers.entities);
      this._onDestroy(() => stateWatcher.unsubscribe(this._stateChangeHandler));

      // Subscribe to event based triggers. List-form `event_type` expands into
      // one subscription per type sharing the same data/context matcher.
      const eventWatcher = options.hassManager.getEventWatcher();
      for (const event of this._config.triggers.events) {
        for (const request of this._buildEventSubscriptionRequests(event)) {
          eventWatcher.subscribe(request);
          this._onDestroy(() => eventWatcher.unsubscribe(request));
        }
      }
    }

    this._initialized = true;
    return this;
  }

  private _buildEventSubscriptionRequests(event: HAEvent): EventSubscriptionRequest[] {
    const dataFilter = event.event_data;
    const contextFilter = event.context;
    return uniq(arrayify(event.event_type)).map((eventType) => ({
      event_type: eventType,
      ...((dataFilter || contextFilter) && {
        matcher: (evt) =>
          (!dataFilter || matchesEventData(dataFilter, evt.data)) &&
          (!contextFilter || matchesEventContext(contextFilter, evt.context)),
      }),
      callback: () => this._momentaryEventHandler(eventType),
    }));
  }

  private _momentaryEventHandler(eventType: string): void {
    this._eventCallback?.({
      cameraID: this.getID(),
      id: `event:${eventType}`,
      type: 'momentary',
    });
  }

  private async _resolveEntity(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<Entity | null> {
    const cameraEntityID = getCameraEntityFromConfig(this._config);
    if (!cameraEntityID || !options.entityRegistryManager) {
      return null;
    }
    return await options.entityRegistryManager.getEntity(hass, cameraEntityID);
  }

  /**
   * Get trigger entities (specified or auto-detected). Subclasses may override
   * to add engine-specific discovery; call `super` to keep the base discoveries.
   */
  protected async _getTriggerEntities(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<void> {
    await this._getDoorbellEntities(hass, options);
  }

  private async _getDoorbellEntities(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<void> {
    if (
      !this._config.triggers.doorbell ||
      !this._entity?.device_id ||
      !options.entityRegistryManager
    ) {
      return;
    }
    const deviceID = this._entity.device_id;

    // `device_class` lives on state attributes (not the registry entry), so
    // narrow by `device_id` + domain first and filter by device_class against
    // `hass.states` second.
    const candidates = await options.entityRegistryManager.getMatchingEntities(
      hass,
      (ent) =>
        ent.device_id === deviceID &&
        !ent.disabled_by &&
        computeDomain(ent.entity_id) === 'event',
    );

    const doorbells = candidates
      .filter(
        (ent) => hass.states[ent.entity_id]?.attributes?.device_class === 'doorbell',
      )
      .map((ent) => ent.entity_id);

    this._config.triggers.entities.push(...doorbells);
  }

  /**
   * Subclass initialization hook. Override for async initialization work.
   */
  protected async _initialize(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _hass: HomeAssistant,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: CameraInitializationOptions,
  ): Promise<void> {}

  protected async _buildCapabilities(
    hass: HomeAssistant,
    options: CameraInitializationOptions,
  ): Promise<Capabilities> {
    const rawCapabilities = await this._getRawCapabilities(hass, options);
    const config = this.getConfig();
    const has2WayAudio = await this._has2WayAudioCapability(hass);

    return new Capabilities(
      {
        ...rawCapabilities,
        '2-way-audio': has2WayAudio,
      },
      {
        disable: config.capabilities?.disable,
        disableExcept: config.capabilities?.disable_except,
      },
    );
  }

  protected async _has2WayAudioCapability(hass: HomeAssistant): Promise<boolean> {
    // Check disable/disableExcept/force early to short-circuit the expensive
    // network call to fetch go2rtc metadata.
    if (this._config.capabilities?.disable?.includes('2-way-audio')) {
      return false;
    }
    const disableExcept = this._config.capabilities?.disable_except;
    if (disableExcept?.length && !disableExcept.includes('2-way-audio')) {
      return false;
    }
    if (this._config.capabilities?.force?.includes('2-way-audio')) {
      return true;
    }
    return await liveProviderSupports2WayAudio(
      hass,
      this.getConfig(),
      this.getConfig().go2rtc.metadata_fetch_timeout_seconds,
      this._getGo2RTCMetadataEndpoint(),
      this.getLiveProxyConfig(),
    );
  }

  /**
   * Get raw capabilities for this camera. Subclasses should override
   * and call super._getRawCapabilities() to extend defaults.
   */
  protected async _getRawCapabilities(
    _hass: HomeAssistant,
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
    const callbacks = this._destroyCallbacks;
    this._destroyCallbacks = [];
    await Promise.all(callbacks.map((callback) => callback()));
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
      ...resolveProxyConfig(this._config.proxy),
      live:
        this._config.proxy.live === 'auto'
          ? // Live is proxied if the live provider is go2rtc and if a go2rtc
            // URL is manually set.
            this._config.live_provider === 'go2rtc' && !!this._config.go2rtc?.url
          : this._config.proxy.live,
      media: this._config.proxy.media === 'auto' ? false : this._config.proxy.media,
    };
  }

  public getLiveProxyConfig(): EnabledProxyConfig {
    const config = this.getProxyConfig();
    return {
      ...config,

      // `enabled` uses the resolved engine decision (so `auto` may become
      // true), whereas `enforce` uses the raw user setting so only an explicit
      // `true` means "fail instead of falling back" if the proxy is unavailable.
      enabled: config.live,
      enforce: this._config.proxy.live === true,
    };
  }

  public getMediaProxyConfig(): EnabledProxyConfig {
    const config = this.getProxyConfig();
    return {
      ...config,

      // `enabled` uses the resolved engine decision (so `auto` may become
      // true), whereas `enforce` uses the raw user setting so only an explicit
      // `true` means "fail instead of falling back" if the proxy is unavailable.
      enabled: config.media,
      enforce: this._config.proxy.media === true,
    };
  }

  public async executePTZAction(
    executor: ActionsExecutor,
    action: PTZAction,
    options?: {
      hass?: HomeAssistant;
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
    const type = getTriggerEventType(difference);
    if (type === null) {
      return;
    }
    this._eventCallback?.({
      cameraID: this.getID(),
      id: difference.entityID,
      type,
    });
  };

  protected _onDestroy(callback: DestroyCallback): void {
    this._destroyCallbacks.push(callback);
  }
}
