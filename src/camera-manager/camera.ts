import { isEqual, uniq } from 'lodash-es';
import type { ReadonlyDeep } from 'type-fest';

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
import { getGo2RTCMetadataEndpoint, getGo2RTCStreamEndpoint } from '../go2rtc/endpoint';
import { computeDomain } from '../ha/compute-domain';
import { matchesEventContext, matchesEventData } from '../ha/event-match';
import { getTriggerEventType } from '../ha/get-trigger-event-type';
import type { Entity, EntityRegistryManager } from '../ha/registry/entity/types';
import type { HassStateDifference, HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import type { CapabilitiesRaw, Endpoint, UnsubscribeCallback } from '../types';
import { arrayify, errorToConsole } from '../utils/basic';
import {
  isGo2RTCLiveProvider,
  liveProviderSupports2WayAudio,
} from '../utils/live-provider';
import { Capabilities } from './capabilities';
import type { CameraManagerEngine } from './engine';
import { CameraInitializationError, CameraNoIDError } from './error';
import type {
  CameraEndpoints,
  CameraEndpointsContext,
  CameraEventCallback,
  CameraProxyConfig,
} from './types';
import { getCameraEntityFromConfig } from './utils/camera-entity-from-config';
import { getConfiguredPTZAction, getPTZCapabilitiesFromCameraConfig } from './utils/ptz';

export interface CameraDependencies {
  hassManager: HASSManagerReadonlyInterface;
  entityRegistryManager?: EntityRegistryManager;
}

export interface CameraOptions {
  eventCallback?: CameraEventCallback;
}

export class Camera {
  protected _config: ReadonlyDeep<CameraConfig>;
  protected _engine: CameraManagerEngine;
  protected _id: string | null = null;

  private _detectedTriggerEntities: string[] = [];

  // The initialization in progress so a second concurrent request joins it.
  private _initializationInFlight: Promise<boolean> | null = null;

  protected _hassManager: HASSManagerReadonlyInterface;
  protected _entityRegistryManager?: EntityRegistryManager;

  protected _capabilities: Capabilities | null = null;
  private _capabilitiesProvisional: Capabilities | null = null;

  protected _eventCallback: CameraEventCallback | null = null;
  protected _unsubscribeCallbacks: UnsubscribeCallback[] = [];
  protected _entity: Entity | null = null;

  protected _initialized = false;
  protected _degraded = false;
  private _subscribed = false;

  constructor(
    config: CameraConfig,
    engine: CameraManagerEngine,
    dependencies: CameraDependencies,
    options?: CameraOptions,
  ) {
    this._config = config;
    this._engine = engine;

    this._hassManager = dependencies.hassManager;
    this._entityRegistryManager = dependencies.entityRegistryManager;

    this._eventCallback = options?.eventCallback ?? null;
  }

  public getEntity(): Entity | null {
    return this._entity;
  }

  public isInitialized(): boolean {
    return this._initialized;
  }

  public isDegraded(): boolean {
    return this._degraded;
  }

  /**
   * Resolve everything the camera needs to serve: the registry entity, its
   * capabilities (network probes included) and its trigger entities. Must hold
   * no resources, so a failure leaks nothing and the camera can simply be
   * discarded. There is deliberately no inverse to undo.
   * Live subscriptions are registered separately by `subscribe()`. A failure is
   * left to propagate to the caller which discards the camera.
   */
  public async initialize(): Promise<this> {
    const hass = this._hassManager.getHASS();
    if (!hass) {
      return this;
    }

    await this._runInitialization(hass);

    this._initialized = true;
    return this;
  }

  public async reinitialize(): Promise<boolean> {
    const hass = this._hassManager.getHASS();
    return hass ? await this._runInitialization(hass) : false;
  }

  // A second caller joins the initialization already running rather than
  // starting another.
  private async _runInitialization(hass: HomeAssistant): Promise<boolean> {
    this._initializationInFlight ??= this._initialize(hass).finally(
      () => (this._initializationInFlight = null),
    );
    return await this._initializationInFlight;
  }

  private async _initialize(hass: HomeAssistant): Promise<boolean> {
    this._degraded = false;
    const triggerEntitiesBefore = this.getTriggerEntities();

    this._entity = await this._resolveEntity(hass);
    await this._initializeBeforeCapabilities(hass);

    const capabilities = this._mergeWithPreviousCapabilities(
      await this._buildCapabilities(hass),
    );

    if (capabilities.has('trigger')) {
      await this._detectTriggerEntities(hass);
    }
    const triggerEntitiesChanged = !isEqual(
      triggerEntitiesBefore,
      this.getTriggerEntities(),
    );

    const changed =
      triggerEntitiesChanged ||
      !isEqual(
        capabilities.getRawCapabilities(),
        this._capabilities?.getRawCapabilities(),
      );

    this._capabilities = capabilities;

    if (this._subscribed && triggerEntitiesChanged) {
      this.unsubscribe();
      this.subscribe();
    }

    return changed;
  }

  private _mergeWithPreviousCapabilities(capabilities: Capabilities): Capabilities {
    const previous = this._capabilities;
    if (!this._degraded || !previous) {
      return capabilities;
    }
    return this._createCapabilities({
      ...previous.getRawCapabilities(),
      ...capabilities.getRawCapabilities(),
    });
  }

  private async _detectTriggerEntities(hass: HomeAssistant): Promise<void> {
    try {
      this._detectedTriggerEntities = await this._getDetectedTriggerEntities(hass);
    } catch (error) {
      if (error instanceof CameraInitializationError) {
        // Initializing again cannot fix a misconfiguration (e.g. an entity that
        // does not exist), so the camera fails rather than degrades.
        throw error;
      }

      errorToConsole(error);
      this._degraded = true;
    }
  }

  // The configured trigger entities plus the auto-detected ones.
  public getTriggerEntities(): string[] {
    return uniq([...this._config.triggers.entities, ...this._detectedTriggerEntities]);
  }

  /**
   * Register the camera's live subscriptions. Synchronous and failure-atomic:
   * either every subscription registers, or everything this attempt registered
   * is released before the error propagates. Idempotent, and a no-op for a
   * camera that was never initialized.
   */
  public subscribe(): void {
    if (this._subscribed || !this._initialized) {
      return;
    }
    try {
      this._subscribe();
    } catch (e) {
      this.unsubscribe();
      throw e;
    }
    this._subscribed = true;
  }

  /**
   * Release everything `subscribe()` registered. Synchronous, idempotent, and
   * safe on a camera that was never subscribed.
   */
  public unsubscribe(): void {
    const callbacks = this._unsubscribeCallbacks;
    this._unsubscribeCallbacks = [];
    this._subscribed = false;
    callbacks.forEach((callback) => callback());
  }

  /**
   * Subclass hook for subscription registration.
   */
  protected _subscribe(): void {
    if (!this._capabilities?.has('trigger')) {
      return;
    }

    // Subscribe to state based triggers.
    const stateWatcher = this._hassManager.getStateWatcher();
    stateWatcher.subscribe(this._stateChangeHandler, this.getTriggerEntities());
    this._addUnsubscribeCallback(() =>
      stateWatcher.unsubscribe(this._stateChangeHandler),
    );

    // Subscribe to event based triggers. List-form `event_type` expands into
    // one subscription per type sharing the same data/context matcher.
    const eventWatcher = this._hassManager.getEventWatcher();
    for (const event of this._config.triggers.events) {
      for (const request of this._buildEventSubscriptionRequests(event)) {
        eventWatcher.subscribe(request);
        this._addUnsubscribeCallback(() => eventWatcher.unsubscribe(request));
      }
    }
  }

  private _buildEventSubscriptionRequests(
    event: ReadonlyDeep<HAEvent>,
  ): EventSubscriptionRequest[] {
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

  private async _resolveEntity(hass: HomeAssistant): Promise<Entity | null> {
    const cameraEntityID = getCameraEntityFromConfig(this._config);
    if (!cameraEntityID || !this._entityRegistryManager) {
      return null;
    }
    return await this._entityRegistryManager.getEntity(hass, cameraEntityID);
  }

  /**
   * The entities to trigger from that are auto-detected rather than configured.
   * Subclasses may override to add engine-specific detection; call `super` to
   * keep the base ones.
   */
  protected async _getDetectedTriggerEntities(hass: HomeAssistant): Promise<string[]> {
    return await this._getDoorbellEntities(hass);
  }

  private async _getDoorbellEntities(hass: HomeAssistant): Promise<string[]> {
    if (
      !this._config.triggers.doorbell ||
      !this._entity?.device_id ||
      !this._entityRegistryManager
    ) {
      return [];
    }
    const deviceID = this._entity.device_id;

    // `device_class` lives on state attributes (not the registry entry), so
    // narrow by `device_id` + domain first and filter by device_class against
    // `hass.states` second.
    const candidates = await this._entityRegistryManager.getMatchingEntities(
      hass,
      (ent) =>
        ent.device_id === deviceID &&
        !ent.disabled_by &&
        computeDomain(ent.entity_id) === 'event',
    );

    return candidates
      .filter(
        (ent) => hass.states[ent.entity_id]?.attributes?.device_class === 'doorbell',
      )
      .map((ent) => ent.entity_id);
  }

  /**
   * Resolve the engine-specific identifiers and companion entities that
   * capability-building and endpoints depend on. Runs after the base entity is
   * resolved and before capabilities are built.
   */
  protected async _initializeBeforeCapabilities(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _hass: HomeAssistant,
  ): Promise<void> {}

  protected async _buildCapabilities(hass: HomeAssistant): Promise<Capabilities> {
    // Merge the config-only capabilities with those resolved during
    // initialization. The config-only set is re-derived here rather than reused
    // from the cached provisional set, so it reflects any config an engine
    // resolved in `_initializeBeforeCapabilities` (e.g. a Frigate camera name).
    // 2-way-audio is a probe shared by every engine, so it is applied last.
    const has2WayAudio = await this._has2WayAudioCapability(hass);

    if (has2WayAudio === null) {
      // Did not get a decisive result on whether 2-way audio is supported.
      this._degraded = true;
    }

    return this._createCapabilities({
      ...this._deriveConfiguredCapabilities(),
      ...(await this._deriveResolvedCapabilities(hass)),
      ...(has2WayAudio !== null && { '2-way-audio': has2WayAudio }),
    });
  }

  private _createCapabilities(raw: CapabilitiesRaw): Capabilities {
    return new Capabilities(raw, {
      disable: this._config.capabilities?.disable,
      disableExcept: this._config.capabilities?.disable_except,
    });
  }

  // Whether the camera carries 2-way audio, or `null` when unknown.
  protected async _has2WayAudioCapability(hass: HomeAssistant): Promise<boolean | null> {
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
   * The capabilities resolved during initialization: entries that need the
   * resolved registry entity or a network probe. The base camera has none.
   * Subclasses override to add their own, and must emit a capability's full
   * value, since these are shallow-merged over the config-only set in
   * `_buildCapabilities`.
   */
  protected async _deriveResolvedCapabilities(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _hass: HomeAssistant,
  ): Promise<CapabilitiesRaw> {
    return {};
  }

  public getConfig(): ReadonlyDeep<CameraConfig> {
    return this._config;
  }

  public setID(cameraID: string): void {
    this._id = cameraID;
  }

  public getID(): string {
    const cameraID = this._getID();
    if (cameraID) {
      return cameraID;
    }
    throw new CameraNoIDError(localize('error.no_camera_id'));
  }

  protected _getID(): string | null {
    return this._id ?? this._config.id ?? null;
  }

  public getEngine(): CameraManagerEngine {
    return this._engine;
  }

  /**
   * Get the camera's capabilities: the resolved set once initialization has
   * built one, otherwise a provisional set derived from configuration alone.
   * The provisional set only claims what configuration proves, so
   * initialization may add capabilities but never removes one.
   */
  public getCapabilities(): Capabilities {
    if (this._capabilities) {
      return this._capabilities;
    }

    // Built on first use rather than at construction: subclasses contribute to
    // the raw capabilities, and their fields are not yet assigned while the
    // base constructor is still running.
    this._capabilitiesProvisional ??= this._createCapabilities(
      this._deriveConfiguredCapabilities(),
    );
    return this._capabilitiesProvisional;
  }

  /**
   * The capabilities derivable from configuration alone, with no resolved entity
   * or network probe. Subclasses override and call
   * super._deriveConfiguredCapabilities() to extend defaults.
   */
  protected _deriveConfiguredCapabilities(): CapabilitiesRaw {
    const configPTZ = getPTZCapabilitiesFromCameraConfig(this._config);
    return {
      live: true,
      menu: true,
      substream: true,
      trigger: true,
      'remote-control-entity': true,
      ...(configPTZ && { ptz: configPTZ }),

      // Only `force` is referred to here: `disable`/`disable_except` are
      // applied centrally by `_createCapabilities`.
      ...(this._config.capabilities?.force?.includes('2-way-audio') && {
        '2-way-audio': true,
      }),
    };
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
          ? // Live is proxied if the live provider streams from go2rtc and a
            // go2rtc URL is manually set.
            isGo2RTCLiveProvider(this._config.live_provider) &&
            !!this._config.go2rtc?.url
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

  protected _addUnsubscribeCallback(callback: UnsubscribeCallback): void {
    this._unsubscribeCallbacks.push(callback);
  }
}
