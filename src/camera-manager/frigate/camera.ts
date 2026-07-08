import { format } from 'date-fns';

import type { ActionsExecutor } from '../../card-controller/actions/types';
import type { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import type { CameraConfig } from '../../config/schema/cameras';
import type { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import type { HomeAssistant } from '../../ha/types';
import { SEVERITIES } from '../../severity';
import {
  PTZMovementType,
  type CapabilitiesRaw,
  type Endpoint,
  type PTZCapabilities,
} from '../../types';
import { errorToConsole } from '../../utils/basic';
import { Camera, type CameraInitializationOptions } from '../camera';
import { CameraNoEntityError } from '../error';
import type { CameraEndpoints, CameraEndpointsContext } from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import {
  getGo2RTCMetadataEndpoint,
  getGo2RTCStreamEndpoint,
} from '../utils/go2rtc/endpoint';
import { getPTZCapabilitiesFromCameraConfig, mergePTZCapabilities } from '../utils/ptz';
import { getPTZInfo } from './requests';
import {
  FRIGATE_SEVERITY_MAP,
  type FrigateEventChange,
  type FrigateReviewChange,
  type PTZInfo,
} from './types';
import type {
  FrigateWatcherRequest,
  FrigateWatcherSubscriptionInterface,
} from './watcher';

const CAMERA_BIRDSEYE = 'birdseye' as const;

interface FrigateCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  frigateEventWatcher: FrigateWatcherSubscriptionInterface<FrigateEventChange>;
  frigateReviewWatcher: FrigateWatcherSubscriptionInterface<FrigateReviewChange>;
}

export const isBirdseye = (cameraConfig: CameraConfig): boolean => {
  return cameraConfig.frigate.camera_name === CAMERA_BIRDSEYE;
};

export class FrigateCamera extends Camera {
  // Short-circuits subscription when destroy() was invoked while base
  // initialization was still awaiting. Set BEFORE awaiting `super.destroy()` so
  // an in-flight initialize() sees the flip immediately.
  private _destroyed = false;

  public async initialize(options: FrigateCameraInitializationOptions): Promise<Camera> {
    await super.initialize(options);

    // A destroy() during the await above means the camera is being torn down;
    // it must not register live subscriptions afterward.
    if (this._destroyed) {
      return this;
    }

    if (this._capabilities?.has('trigger')) {
      this._subscribeToEvents(options.frigateEventWatcher);
      this._subscribeToReviews(options.frigateReviewWatcher);
    }

    return this;
  }

  public override async destroy(): Promise<void> {
    this._destroyed = true;
    await super.destroy();
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

  protected override async _initialize(hass: HomeAssistant): Promise<void> {
    const config = this.getConfig();
    const hasCameraName = !!config.frigate?.camera_name;
    const cameraEntity = getCameraEntityFromConfig(config);

    // Frigate needs the entity to derive `camera_name` when one isn't set. The
    // entity is resolved by base Camera; throw here only when its absence
    // breaks Frigate setup.
    if (cameraEntity && !hasCameraName && !this._entity) {
      throw new CameraNoEntityError(config);
    }

    if (this._entity && !hasCameraName) {
      const resolvedName = this._getFrigateCameraNameFromEntity(this._entity);
      if (resolvedName) {
        this._config.frigate.camera_name = resolvedName;
      }
    }

    if (!this._config.frigate.client_id) {
      const stateEntity = cameraEntity ? hass.states[cameraEntity] : undefined;
      const clientID = stateEntity?.attributes?.client_id;

      // Prefer the client_id the entity advertises. When it is unreadable (e.g.
      // the entity is unavailable) assume the integration default:
      // initialization runs once, so leaving client_id unresolved would leave
      // the camera permanently without endpoints.
      this._config.frigate.client_id =
        typeof clientID === 'string' && clientID ? clientID : 'frigate';
    }
  }

  protected override async _getTriggerEntities(
    hass: HomeAssistant,
    options: FrigateCameraInitializationOptions,
  ): Promise<void> {
    await this._getFrigateMotionAndOccupancyEntities(hass, options);
    await super._getTriggerEntities(hass, options);
  }

  private async _getFrigateMotionAndOccupancyEntities(
    hass: HomeAssistant,
    options: FrigateCameraInitializationOptions,
  ): Promise<void> {
    const config = this.getConfig();
    if (!config.triggers.motion && !config.triggers.occupancy) {
      return;
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
    const binarySensorEntities = await options.entityRegistryManager.getMatchingEntities(
      hass,
      (ent) =>
        ent.config_entry_id === this._entity?.config_entry_id &&
        !ent.disabled_by &&
        ent.entity_id.startsWith('binary_sensor.'),
    );

    if (config.triggers.motion) {
      const motionEntity = this._getMotionSensor(config, [
        ...binarySensorEntities.values(),
      ]);
      if (motionEntity) {
        config.triggers.entities.push(motionEntity);
      }
    }

    if (config.triggers.occupancy) {
      const occupancyEntities = this._getOccupancySensor(config, [
        ...binarySensorEntities.values(),
      ]);
      if (occupancyEntities) {
        config.triggers.entities.push(...occupancyEntities);
      }
    }
  }

  protected async _getRawCapabilities(
    hass: HomeAssistant,
    options: FrigateCameraInitializationOptions,
  ): Promise<CapabilitiesRaw> {
    const base = await super._getRawCapabilities(hass, options);
    const config = this.getConfig();

    const frigatePTZ = await this._getPTZCapabilities(hass, config);
    const configPTZ = getPTZCapabilitiesFromCameraConfig(config);
    const combinedPTZ = mergePTZCapabilities(frigatePTZ, configPTZ);

    const birdseye = isBirdseye(config);
    return {
      ...base,
      'favorite-events': !birdseye,
      seek: !birdseye,
      clips: !birdseye,
      snapshots: !birdseye,
      recordings: !birdseye,
      reviews: !birdseye,
      ...(combinedPTZ && { ptz: combinedPTZ }),
    };
  }

  private _getFrigateCameraNameFromEntity(entity: Entity): string | null {
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
      cameraConfig: CameraConfig,
      options: { url: string; stream?: string },
    ) => Endpoint | null,
  ): Endpoint | null {
    const url =
      this._config.go2rtc?.url ??
      (this._config.frigate.client_id
        ? `/api/frigate/${this._config.frigate.client_id}/${path}`
        : null);
    if (!url) {
      return null;
    }
    return builder(this._config, {
      url,
      stream: this._config.go2rtc?.stream ?? this._config.frigate.camera_name,
    });
  }

  protected override _getGo2RTCMetadataEndpoint(): Endpoint | null {
    return this._buildGo2RTCEndpoint('go2rtc', getGo2RTCMetadataEndpoint);
  }

  protected override _getGo2RTCStreamEndpoint(): Endpoint | null {
    return this._buildGo2RTCEndpoint('mse', getGo2RTCStreamEndpoint);
  }

  private _getJSMPEGEndpoint(): Endpoint | null {
    if (!this._config.frigate.camera_name || !this._config.frigate.client_id) {
      return null;
    }
    return {
      endpoint:
        `/api/frigate/${this._config.frigate.client_id}` +
        `/jsmpeg/${this._config.frigate.camera_name}`,
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
    cameraConfig: CameraConfig,
  ): Promise<PTZCapabilities | null> {
    if (
      !cameraConfig.frigate.camera_name ||
      !cameraConfig.frigate.client_id ||
      isBirdseye(cameraConfig)
    ) {
      return null;
    }

    let ptzInfo: PTZInfo | null = null;
    try {
      ptzInfo = await getPTZInfo(
        hass,
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
      );
    } catch (e) {
      errorToConsole(e);
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

  /**
   * Get the motion sensor entity for a given camera.
   * @param cache The EntityCache of entity registry information.
   * @param cameraConfig The camera config in question.
   * @returns The entity id of the motion sensor or null.
   */
  private _getMotionSensor(
    cameraConfig: CameraConfig,
    entities: Entity[],
  ): string | null {
    if (cameraConfig.frigate.camera_name) {
      return (
        entities.find(
          (entity) =>
            typeof entity.unique_id === 'string' &&
            !!entity.unique_id?.match(
              new RegExp(`:motion_sensor:${cameraConfig.frigate.camera_name}`),
            ),
        )?.entity_id ?? null
      );
    }
    return null;
  }

  /**
   * Get the occupancy sensor entity for a given camera.
   * @param cache The EntityCache of entity registry information.
   * @param cameraConfig The camera config in question.
   * @returns The entity id of the occupancy sensor or null.
   */
  private _getOccupancySensor(
    cameraConfig: CameraConfig,
    entities: Entity[],
  ): string[] | null {
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

    if (cameraConfig.frigate.camera_name) {
      // If zone(s) are specified, the master occupancy sensor for the overall
      // camera is not used by default (but could be manually added by the
      // user).
      const camerasAndZones = cameraConfig.frigate.zones?.length
        ? cameraConfig.frigate.zones
        : [cameraConfig.frigate.camera_name];

      const labels = cameraConfig.frigate.labels?.length
        ? cameraConfig.frigate.labels
        : ['all'];
      for (const cameraOrZone of camerasAndZones) {
        for (const label of labels) {
          addEntityIDIfFound(cameraOrZone, label);
        }
      }

      if (entityIDs.length) {
        return entityIDs;
      }
    }
    return null;
  }

  private _subscribeToEvents(
    frigateEventWatcher: FrigateWatcherSubscriptionInterface<FrigateEventChange>,
  ): void {
    const config = this.getConfig();
    if (
      !config.triggers.media_events.length ||
      !config.frigate.camera_name ||
      !config.frigate.client_id
    ) {
      return;
    }

    /* istanbul ignore next -- exercising the matcher is not possible when the
    test uses an event watcher -- @preserve */
    const request: FrigateWatcherRequest<FrigateEventChange> = {
      instanceID: config.frigate.client_id,
      callback: (event: FrigateEventChange) => this._frigateEventHandler(event),
      matcher: (event: FrigateEventChange): boolean =>
        event.after.camera === config.frigate.camera_name,
    };

    frigateEventWatcher.subscribe(request);
    this._onDestroy(() => frigateEventWatcher.unsubscribe(request));
  }

  private _frigateEventHandler = (ev: FrigateEventChange): void => {
    const snapshotChange =
      (!ev.before.has_snapshot && ev.after.has_snapshot) ||
      ev.before.snapshot?.frame_time !== ev.after.snapshot?.frame_time;
    const clipChange = !ev.before.has_clip && ev.after.has_clip;

    const config = this.getConfig();
    const cameraID = this._config.id;

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
    const config = this.getConfig();
    const reviewConfig = config.triggers.reviews;

    // Must have at least one severity configured and a camera name to subscribe
    if (
      !reviewConfig.severities.length ||
      !config.frigate.camera_name ||
      !config.frigate.client_id
    ) {
      return;
    }

    /* istanbul ignore next -- exercising the matcher is not possible when the
    test uses a review watcher -- @preserve */
    const request: FrigateWatcherRequest<FrigateReviewChange> = {
      instanceID: config.frigate.client_id,
      callback: (review: FrigateReviewChange) => this._frigateReviewHandler(review),
      matcher: (review: FrigateReviewChange): boolean =>
        review.after.camera === config.frigate.camera_name,
    };

    frigateReviewWatcher.subscribe(request);
    this._onDestroy(() => frigateReviewWatcher.unsubscribe(request));
  }

  private _frigateReviewHandler = (review: FrigateReviewChange): void => {
    const config = this.getConfig();
    const cameraID = this._config.id;

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

    // Map Frigate severity to card severity.
    const cardSeverity = SEVERITIES.find(
      (key) => FRIGATE_SEVERITY_MAP[key] === review.after.severity,
    );

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
