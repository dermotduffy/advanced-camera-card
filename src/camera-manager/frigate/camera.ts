import { format } from 'date-fns';
import type { ReadonlyDeep } from 'type-fest';

import type { ActionsExecutor } from '../../card-controller/actions/types';
import type { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import type { CameraConfig } from '../../config/schema/cameras';
import {
  getGo2RTCMetadataEndpoint,
  getGo2RTCStreamEndpoint,
} from '../../go2rtc/endpoint';
import type { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import type { HomeAssistant } from '../../ha/types';
import {
  PTZMovementType,
  type CapabilitiesRaw,
  type Endpoint,
  type PTZCapabilities,
} from '../../types';
import { errorToConsole } from '../../utils/basic';
import { Camera, type CameraDependencies, type CameraOptions } from '../camera';
import type { CameraManagerEngine } from '../engine';
import { CameraNoEntityError } from '../error';
import type { CameraEndpoints, CameraEndpointsContext } from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import { getPTZCapabilitiesFromCameraConfig, mergePTZCapabilities } from '../utils/ptz';
import { getPTZInfo } from './requests';
import {
  CARD_SEVERITY_MAP,
  type FrigateEventChange,
  type FrigateIdentity,
  type FrigateReviewChange,
  type PTZInfo,
} from './types';
import type {
  FrigateWatcherRequest,
  FrigateWatcherSubscriptionInterface,
} from './watcher';

const CAMERA_BIRDSEYE = 'birdseye' as const;

export interface FrigateCameraDependencies extends CameraDependencies {
  entityRegistryManager: EntityRegistryManager;
  frigateEventWatcher: FrigateWatcherSubscriptionInterface<FrigateEventChange>;
  frigateReviewWatcher: FrigateWatcherSubscriptionInterface<FrigateReviewChange>;
}

export const isBirdseye = (cameraName: string | null): boolean => {
  return cameraName === CAMERA_BIRDSEYE;
};

export const isFrigateCamera = (camera: Camera | null): camera is FrigateCamera =>
  camera instanceof FrigateCamera;

export class FrigateCamera extends Camera {
  // Frigate cameras require a registry manager to resolve their trigger
  // entities, which the constructor below guarantees; the base camera only
  // optionally has one.
  protected declare _entityRegistryManager: EntityRegistryManager;

  private _frigateEventWatcher: FrigateWatcherSubscriptionInterface<FrigateEventChange>;
  private _frigateReviewWatcher: FrigateWatcherSubscriptionInterface<FrigateReviewChange>;

  private _clientID: string | null = null;
  private _cameraName: string | null = null;

  constructor(
    config: CameraConfig,
    engine: CameraManagerEngine,
    dependencies: FrigateCameraDependencies,
    options?: CameraOptions,
  ) {
    super(config, engine, dependencies, options);
    this._frigateEventWatcher = dependencies.frigateEventWatcher;
    this._frigateReviewWatcher = dependencies.frigateReviewWatcher;
  }

  protected override _subscribe(): void {
    super._subscribe();

    if (this._capabilities?.has('trigger')) {
      this._subscribeToEvents(this._frigateEventWatcher);
      this._subscribeToReviews(this._frigateReviewWatcher);
    }
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
    if (await super.executePTZAction(executor, action, options)) {
      return true;
    }

    const cameraEntity = this.getConfig().camera_entity;
    if ((action === 'preset' && !options?.preset) || !cameraEntity) {
      return false;
    }

    // Awkward translation between card action and service parameters:
    // https://github.com/blakeblackshear/frigate-hass-integration/blob/dev/custom_components/frigate/services.yaml
    await executor.executeActions({
      actions: {
        action: 'perform-action',
        perform_action: 'frigate.ptz',
        data: {
          action:
            options?.phase === 'stop'
              ? 'stop'
              : action === 'zoom_in' || action === 'zoom_out'
                ? 'zoom'
                : action === 'preset'
                  ? 'preset'
                  : 'move',
          ...(options?.phase !== 'stop' && {
            argument:
              action === 'zoom_in'
                ? 'in'
                : action === 'zoom_out'
                  ? 'out'
                  : action === 'preset'
                    ? options?.preset
                    : action,
          }),
        },
        target: { entity_id: cameraEntity },
      },
    });
    return true;
  }

  public getIdentity(): FrigateIdentity | null {
    const clientID = this.getClientID();
    const cameraName = this._getCameraName();
    return clientID && cameraName ? { clientID, cameraName } : null;
  }

  public getClientID(): string | null {
    return this._clientID ?? this.getConfig().frigate.client_id ?? null;
  }

  private _getCameraName(): string | null {
    return this._cameraName ?? this.getConfig().frigate.camera_name ?? null;
  }

  protected override async _initializeBeforeCapabilities(
    hass: HomeAssistant,
  ): Promise<void> {
    await super._initializeBeforeCapabilities(hass);

    const config = this.getConfig();
    const cameraEntity = getCameraEntityFromConfig(config);

    if (cameraEntity && !config.frigate.camera_name && !this._entity) {
      throw new CameraNoEntityError(config);
    }

    this._cameraName = this._resolveCameraName();
    this._clientID = this._resolveClientID(hass, cameraEntity);
  }

  private _resolveCameraName(): string | null {
    return (
      this.getConfig().frigate.camera_name ??
      (this._entity ? this._getCameraNameFromEntity(this._entity) : null)
    );
  }

  private _resolveClientID(hass: HomeAssistant, cameraEntity: string | null): string {
    return (
      this.getConfig().frigate.client_id ??
      this._getClientIDFromEntity(hass, cameraEntity) ??
      // Must have a clientID to serve. Use integration default.
      'frigate'
    );
  }

  private _getCameraNameFromEntity(entity: Entity): string | null {
    if (
      entity.platform === 'frigate' &&
      entity.unique_id &&
      typeof entity.unique_id === 'string'
    ) {
      const match = entity.unique_id.match(/:camera:(?<camera>[^:]+)$/);
      if (match && match.groups) {
        return match.groups['camera'];
      }
    }
    return null;
  }

  private _getClientIDFromEntity(
    hass: HomeAssistant,
    cameraEntity: string | null,
  ): string | null {
    const stateEntity = cameraEntity ? hass.states[cameraEntity] : undefined;

    if (cameraEntity && !stateEntity) {
      // Home Assistant knows the entity but holds no state for it (e.g. the
      // integration is reloading, or another temporary failure), so the client
      // id cannot be detected. Initialization will be retried later.
      this._degraded = true;
    }

    const clientID = stateEntity?.attributes?.client_id;
    return typeof clientID === 'string' && clientID ? clientID : null;
  }

  protected override async _getDetectedTriggerEntities(
    hass: HomeAssistant,
  ): Promise<string[]> {
    return [
      ...(await this._getFrigateMotionAndOccupancyEntities(hass)),
      ...(await super._getDetectedTriggerEntities(hass)),
    ];
  }

  private async _getFrigateMotionAndOccupancyEntities(
    hass: HomeAssistant,
  ): Promise<string[]> {
    const config = this.getConfig();
    const cameraName = this.getIdentity()?.cameraName;
    if ((!config.triggers.motion && !config.triggers.occupancy) || !cameraName) {
      return [];
    }

    // Motion/occupancy auto-discovery requires the camera entity to derive
    // the matching binary_sensor unique_ids.
    if (getCameraEntityFromConfig(config) && !this._entity) {
      throw new CameraNoEntityError(config);
    }

    // Find the correct entities for the motion & occupancy sensors. They
    // are binary_sensors with the same config entry ID as the camera;
    // searching via unique_id ensures this still works if the user renames
    // the entity_id.
    const binarySensorEntities = await this._entityRegistryManager.getMatchingEntities(
      hass,
      (ent) =>
        ent.config_entry_id === this._entity?.config_entry_id &&
        !ent.disabled_by &&
        ent.entity_id.startsWith('binary_sensor.'),
    );

    const entities: string[] = [];

    if (config.triggers.motion) {
      const motionEntity = this._getMotionSensor(cameraName, [
        ...binarySensorEntities.values(),
      ]);
      if (motionEntity) {
        entities.push(motionEntity);
      }
    }

    if (config.triggers.occupancy) {
      const occupancyEntities = this._getOccupancySensors(cameraName, [
        ...binarySensorEntities.values(),
      ]);
      if (occupancyEntities) {
        entities.push(...occupancyEntities);
      }
    }

    return entities;
  }

  protected override _deriveConfiguredCapabilities(): CapabilitiesRaw {
    const cameraName = this.getIdentity()?.cameraName;

    return {
      ...super._deriveConfiguredCapabilities(),
      ...(cameraName && this._getMediaCapabilities(cameraName)),
    };
  }

  protected override async _deriveResolvedCapabilities(
    hass: HomeAssistant,
  ): Promise<CapabilitiesRaw> {
    const frigatePTZ = await this._getPTZCapabilities(hass);
    const configPTZ = getPTZCapabilitiesFromCameraConfig(this.getConfig());
    const combinedPTZ = mergePTZCapabilities(frigatePTZ, configPTZ);

    return {
      ...this._getMediaCapabilities(this._getCameraName()),
      ...(combinedPTZ && { ptz: combinedPTZ }),
    };
  }

  private _getMediaCapabilities(cameraName: string | null): CapabilitiesRaw {
    const birdseye = isBirdseye(cameraName);
    return {
      'favorite-events': !birdseye,
      seek: !birdseye,
      clips: !birdseye,
      snapshots: !birdseye,
      recordings: !birdseye,
      reviews: !birdseye,
    };
  }

  public override getEndpoints(
    context?: CameraEndpointsContext,
  ): CameraEndpoints | null {
    const base = super.getEndpoints(context);
    const jsmpeg = this._getJSMPEGEndpoint();

    if (!base && !jsmpeg) {
      return null;
    }

    return {
      ...base,
      ...(jsmpeg && { jsmpeg }),
    };
  }

  // Build a go2rtc endpoint from an explicitly-configured go2rtc URL, or
  // otherwise from the Frigate integration's proxy under the given path (the
  // integration exposes the go2rtc stream API under 'mse' and the metadata API
  // under 'go2rtc'). Without either a configured URL or a resolved client_id
  // there is no usable endpoint.
  private _buildGo2RTCEndpoint(
    path: 'go2rtc' | 'mse',
    builder: (
      cameraConfig: ReadonlyDeep<CameraConfig>,
      options: { url: string; stream?: string },
    ) => Endpoint | null,
  ): Endpoint | null {
    const clientID = this.getClientID();
    const url =
      this._config.go2rtc?.url ?? (clientID ? `/api/frigate/${clientID}/${path}` : null);
    if (!url) {
      return null;
    }
    return builder(this._config, {
      url,
      stream: this._config.go2rtc?.stream ?? this._getCameraName() ?? undefined,
    });
  }

  protected override _getGo2RTCMetadataEndpoint(): Endpoint | null {
    return this._buildGo2RTCEndpoint('go2rtc', getGo2RTCMetadataEndpoint);
  }

  protected override _getGo2RTCStreamEndpoint(): Endpoint | null {
    return this._buildGo2RTCEndpoint('mse', getGo2RTCStreamEndpoint);
  }

  private _getJSMPEGEndpoint(): Endpoint | null {
    const identity = this.getIdentity();
    if (!identity) {
      return null;
    }
    return {
      endpoint: `/api/frigate/${identity.clientID}/jsmpeg/${identity.cameraName}`,
      sign: true,
    };
  }

  protected override _getUIEndpoint(context?: CameraEndpointsContext): Endpoint | null {
    if (!this._config.frigate.url) {
      return null;
    }
    if (!this._config.frigate.camera_name) {
      return { endpoint: this._config.frigate.url };
    }

    const cameraURL = `${this._config.frigate.url}/#${this._config.frigate.camera_name}`;

    if (context?.view === 'live') {
      return { endpoint: cameraURL };
    }

    const eventsURL = `${this._config.frigate.url}/events?camera=${this._config.frigate.camera_name}`;
    const recordingsURL = `${this._config.frigate.url}/recording/${this._config.frigate.camera_name}`;

    // If media is available, use it for a more precise URL.
    switch (context?.media?.getMediaType()) {
      case 'clip':
      case 'snapshot':
        return { endpoint: eventsURL };
      case 'recording':
        const startTime = context.media.getStartTime();
        return {
          endpoint:
            recordingsURL + (startTime ? '/' + format(startTime, 'yyyy-MM-dd/HH') : ''),
        };
    }

    // Fall back to using the view.
    switch (context?.view) {
      case 'clip':
      case 'clips':
      case 'snapshots':
      case 'snapshot':
        return { endpoint: eventsURL };
      case 'recording':
      case 'recordings':
        return { endpoint: recordingsURL };
    }

    return { endpoint: cameraURL };
  }

  private async _getPTZCapabilities(
    hass: HomeAssistant,
  ): Promise<PTZCapabilities | null> {
    const identity = this.getIdentity();
    if (!identity || isBirdseye(identity.cameraName)) {
      return null;
    }

    let ptzInfo: PTZInfo | null = null;
    try {
      ptzInfo = await getPTZInfo(hass, identity);
    } catch (e) {
      errorToConsole(e);

      // Could not get PTZ capabilities: degrade to allow re-attempt later.
      this._degraded = true;
      return null;
    }

    // Note: The Frigate integration only supports continuous PTZ movements
    // (regardless of the actual underlying camera capability).
    const panTilt: PTZMovementType[] = [
      ...(ptzInfo.features?.includes('pt') ? [PTZMovementType.Continuous] : []),
    ];
    const zoom: PTZMovementType[] = [
      ...(ptzInfo.features?.includes('zoom') ? [PTZMovementType.Continuous] : []),
    ];
    const presets = ptzInfo.presets;

    if (panTilt.length || zoom.length || presets?.length) {
      return {
        ...(panTilt.length && {
          left: panTilt,
          right: panTilt,
          up: panTilt,
          down: panTilt,
        }),
        ...(zoom.length && { zoomIn: zoom, zoomOut: zoom }),
        ...(presets?.length && { presets: presets }),
      };
    }
    return null;
  }

  private _getMotionSensor(cameraName: string, entities: Entity[]): string | null {
    return (
      entities.find(
        (entity) =>
          typeof entity.unique_id === 'string' &&
          !!entity.unique_id?.match(new RegExp(`:motion_sensor:${cameraName}`)),
      )?.entity_id ?? null
    );
  }

  // One entity per configured zone and label, so a camera can have several.
  private _getOccupancySensors(cameraName: string, entities: Entity[]): string[] | null {
    const cameraConfig = this.getConfig();
    const entityIDs: string[] = [];
    const addEntityIDIfFound = (cameraOrZone: string, label: string): void => {
      const entityID =
        entities.find(
          (entity) =>
            typeof entity.unique_id === 'string' &&
            !!entity.unique_id?.match(
              new RegExp(`:occupancy_sensor:${cameraOrZone}_${label}`),
            ),
        )?.entity_id ?? null;
      if (entityID) {
        entityIDs.push(entityID);
      }
    };

    // If zone(s) are specified, the master occupancy sensor for the overall
    // camera is not used by default (but could be manually added by the user).
    const camerasAndZones = cameraConfig.frigate.zones?.length
      ? cameraConfig.frigate.zones
      : [cameraName];

    const labels = cameraConfig.frigate.labels?.length
      ? cameraConfig.frigate.labels
      : ['all'];
    for (const cameraOrZone of camerasAndZones) {
      for (const label of labels) {
        addEntityIDIfFound(cameraOrZone, label);
      }
    }

    return entityIDs.length ? entityIDs : null;
  }

  private _subscribeToEvents(
    frigateEventWatcher: FrigateWatcherSubscriptionInterface<FrigateEventChange>,
  ): void {
    const identity = this.getIdentity();
    if (!this.getConfig().triggers.media_events.length || !identity) {
      return;
    }

    /* v8 ignore next -- exercising the matcher is not possible when the
    test uses an event watcher -- @preserve */
    const request: FrigateWatcherRequest<FrigateEventChange> = {
      instanceID: identity.clientID,
      callback: (event: FrigateEventChange) => this._frigateEventHandler(event),
      matcher: (event: FrigateEventChange): boolean =>
        event.after.camera === identity.cameraName,
    };

    frigateEventWatcher.subscribe(request);
    this._addUnsubscribeCallback(() => frigateEventWatcher.unsubscribe(request));
  }

  private _frigateEventHandler = (ev: FrigateEventChange): void => {
    const snapshotChange =
      (!ev.before.has_snapshot && ev.after.has_snapshot) ||
      ev.before.snapshot?.frame_time !== ev.after.snapshot?.frame_time;
    const clipChange = !ev.before.has_clip && ev.after.has_clip;

    const config = this.getConfig();
    const cameraID = this._getID();

    if (!cameraID) {
      // This can happen if an event arrives during the time a camera is
      // initializing.
      return;
    }

    const mediaEventsToTriggerOn = config.triggers.media_events;

    // The zone/label/media checks decide when to START a trigger, so they only
    // apply to 'new'/'update'. An 'end' always passes through: it ends whatever
    // trigger an earlier event with the same id started, and by 'end' the
    // object may have left the zone or the media flag may differ -- the trigger
    // must still clear. (The trigger manager ignores an 'end' for an id that
    // never triggered, so a pass-through 'end' is harmless.)
    if (ev.type !== 'end') {
      if (
        (config.frigate.zones?.length &&
          !config.frigate.zones.some((zone) => ev.after.current_zones.includes(zone))) ||
        (config.frigate.labels?.length &&
          !config.frigate.labels.includes(ev.after.label))
      ) {
        return;
      }

      if (
        !(
          mediaEventsToTriggerOn.includes('events') ||
          (mediaEventsToTriggerOn.includes('snapshots') && snapshotChange) ||
          (mediaEventsToTriggerOn.includes('clips') && clipChange)
        )
      ) {
        return;
      }
    }

    this._eventCallback?.({
      cameraID,
      id: ev.after.id,
      fidelity: 'high',
      type: ev.type,
      // In cases where there are both clip and snapshot media, ensure to only
      // trigger on the media type that is allowed by the configuration.
      clip: clipChange && mediaEventsToTriggerOn.includes('clips'),
      snapshot: snapshotChange && mediaEventsToTriggerOn.includes('snapshots'),
    });
  };

  private _subscribeToReviews(
    frigateReviewWatcher: FrigateWatcherSubscriptionInterface<FrigateReviewChange>,
  ): void {
    const identity = this.getIdentity();

    // Must have at least one severity configured and a camera name to subscribe
    if (!this.getConfig().triggers.reviews.severities.length || !identity) {
      return;
    }

    /* v8 ignore next -- exercising the matcher is not possible when the
    test uses a review watcher -- @preserve */
    const request: FrigateWatcherRequest<FrigateReviewChange> = {
      instanceID: identity.clientID,
      callback: (review: FrigateReviewChange) => this._frigateReviewHandler(review),
      matcher: (review: FrigateReviewChange): boolean =>
        review.after.camera === identity.cameraName,
    };

    frigateReviewWatcher.subscribe(request);
    this._addUnsubscribeCallback(() => frigateReviewWatcher.unsubscribe(request));
  }

  private _frigateReviewHandler = (review: FrigateReviewChange): void => {
    const config = this.getConfig();
    const cameraID = this._getID();

    if (!cameraID) {
      return;
    }

    if (
      config.frigate.zones?.length &&
      !config.frigate.zones.some((zone) => review.after.data.zones?.includes(zone))
    ) {
      return;
    }

    if (
      config.frigate.labels?.length &&
      !config.frigate.labels.some((label) => review.after.data.objects?.includes(label))
    ) {
      return;
    }

    const reviewConfig = config.triggers.reviews;

    const cardSeverity = CARD_SEVERITY_MAP[review.after.severity];

    // Check if this is a description update (GenAI added/changed title or scene)
    const isDescriptionUpdate =
      review.type === 'genai' ||
      (review.type === 'update' &&
        (review.after.data.metadata?.title !== review.before.data.metadata?.title ||
          review.after.data.metadata?.scene !== review.before.data.metadata?.scene ||
          review.after.data.metadata?.shortSummary !==
            review.before.data.metadata?.shortSummary));

    const shouldTriggerOnSeverity =
      cardSeverity && reviewConfig.severities.includes(cardSeverity);

    // Severity must match first - it's the gate condition.
    if (!shouldTriggerOnSeverity) {
      return;
    }

    // For 'update' events, only trigger if description changed (when
    // description updates are on). For 'new' and 'end' events, always trigger
    // if severity matched
    const shouldTriggerOnDescription = reviewConfig.description && isDescriptionUpdate;

    if (review.type === 'update' && !shouldTriggerOnDescription) {
      return;
    }

    this._eventCallback?.({
      cameraID,
      id: review.after.id,
      fidelity: 'high',
      type: review.type,
      review: true,
    });
  };
}
