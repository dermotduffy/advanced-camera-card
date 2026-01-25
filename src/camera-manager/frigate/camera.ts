import { format } from 'date-fns';
import { uniq } from 'lodash-es';
import { ActionsExecutor } from '../../card-controller/actions/types';
import { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import { CameraConfig } from '../../config/schema/cameras';
import { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { SEVERITIES } from '../../severity';
import {
  CapabilitiesRaw,
  Endpoint,
  PTZCapabilities,
  PTZMovementType,
} from '../../types';
import { errorToConsole } from '../../utils/basic';
import { Camera, CameraInitializationOptions } from '../camera';
import { CameraInitializationError } from '../error';
import { CameraEndpoints, CameraEndpointsContext } from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import {
  getGo2RTCMetadataEndpoint,
  getGo2RTCStreamEndpoint,
} from '../utils/go2rtc/endpoint';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';
import { getPTZInfo } from './requests';
import {
  FRIGATE_SEVERITY_MAP,
  FrigateEventChange,
  FrigateReviewChange,
  PTZInfo,
} from './types';
import { FrigateWatcherRequest, FrigateWatcherSubscriptionInterface } from './watcher';

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
  public async initialize(options: FrigateCameraInitializationOptions): Promise<Camera> {
    await this._initializeConfig(options.hass, options.entityRegistryManager);
    await super.initialize(options);

    if (this._capabilities?.has('trigger')) {
      await this._subscribeToEvents(options.hass, options.frigateEventWatcher);
      await this._subscribeToReviews(options.hass, options.frigateReviewWatcher);
    }

    return this;
  }

  public async executePTZAction(
    executor: ActionsExecutor,
    action: PTZAction,
    options?: {
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

  protected async _initializeConfig(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
  ): Promise<void> {
    const config = this.getConfig();
    const hasCameraName = !!config.frigate?.camera_name;
    const hasAutoTriggers = config.triggers.motion || config.triggers.occupancy;

    let entity: Entity | null = null;
    const cameraEntity = getCameraEntityFromConfig(config);

    // Entity information is required if the Frigate camera name is missing, or
    // if the entity requires automatic resolution of motion/occupancy sensors.
    if (cameraEntity && (!hasCameraName || hasAutoTriggers)) {
      entity = await entityRegistryManager.getEntity(hass, cameraEntity);
      if (!entity) {
        throw new CameraInitializationError(localize('error.no_camera_entity'), config);
      }
    }

    if (entity && !hasCameraName) {
      const resolvedName = this._getFrigateCameraNameFromEntity(entity);
      if (resolvedName) {
        this._config.frigate.camera_name = resolvedName;
      }
    }

    if (hasAutoTriggers) {
      // Try to find the correct entities for the motion & occupancy sensors.
      // We know they are binary_sensors, and that they'll have the same
      // config entry ID as the camera. Searching via unique_id ensures this
      // search still works if the user renames the entity_id.
      const binarySensorEntities = await entityRegistryManager.getMatchingEntities(
        hass,
        (ent) =>
          ent.config_entry_id === entity?.config_entry_id &&
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

      // De-duplicate triggering entities.
      config.triggers.entities = uniq(config.triggers.entities);
    }
  }

  protected async _getRawCapabilities(
    options: FrigateCameraInitializationOptions,
  ): Promise<CapabilitiesRaw> {
    const base = await super._getRawCapabilities(options);
    const config = this.getConfig();

    const frigatePTZ = await this._getPTZCapabilities(options.hass, config);
    const configPTZ = getPTZCapabilitiesFromCameraConfig(config);
    const combinedPTZ: PTZCapabilities | null =
      configPTZ || frigatePTZ ? { ...frigatePTZ, ...configPTZ } : null;

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

  protected _getFrigateCameraNameFromEntity(entity: Entity): string | null {
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

  protected override _getGo2RTCMetadataEndpoint(): Endpoint | null {
    const stream = this._config.go2rtc?.stream ?? this._config.frigate.camera_name;
    const url =
      this._config.go2rtc?.url ??
      `/api/frigate/${this._config.frigate.client_id}/go2rtc`;
    return getGo2RTCMetadataEndpoint(this._config, { url, stream });
  }

  protected override _getGo2RTCStreamEndpoint(): Endpoint | null {
    const stream = this._config.go2rtc?.stream ?? this._config.frigate.camera_name;
    const url =
      this._config.go2rtc?.url ??
      // go2rtc is exposed by the Frigate integration under the 'mse' path.
      `/api/frigate/${this._config.frigate.client_id}/mse`;

    return getGo2RTCStreamEndpoint(this._config, {
      url,
      stream,
    });
  }

  protected _getJSMPEGEndpoint(): Endpoint | null {
    if (!this._config.frigate.camera_name) {
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

  protected async _getPTZCapabilities(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<PTZCapabilities | null> {
    if (!cameraConfig.frigate.camera_name || isBirdseye(cameraConfig)) {
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
      errorToConsole(e as Error);
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
  protected _getMotionSensor(
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
  protected _getOccupancySensor(
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

  protected async _subscribeToEvents(
    hass: HomeAssistant,
    frigateEventWatcher: FrigateWatcherSubscriptionInterface<FrigateEventChange>,
  ): Promise<void> {
    const config = this.getConfig();
    if (!config.triggers.events.length || !config.frigate.camera_name) {
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

    await frigateEventWatcher.subscribe(hass, request);
    this._onDestroy(() => frigateEventWatcher.unsubscribe(request));
  }

  protected _frigateEventHandler = (ev: FrigateEventChange): void => {
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

    if (
      (config.frigate.zones?.length &&
        !config.frigate.zones.some((zone) => ev.after.current_zones.includes(zone))) ||
      (config.frigate.labels?.length && !config.frigate.labels.includes(ev.after.label))
    ) {
      return;
    }

    const eventsToTriggerOn = config.triggers.events;
    if (
      !(
        eventsToTriggerOn.includes('events') ||
        (eventsToTriggerOn.includes('snapshots') && snapshotChange) ||
        (eventsToTriggerOn.includes('clips') && clipChange)
      )
    ) {
      return;
    }

    this._eventCallback?.({
      cameraID,

      fidelity: 'high',
      type: ev.type,
      // In cases where there are both clip and snapshot media, ensure to only
      // trigger on the media type that is allowed by the configuration.
      clip: clipChange && eventsToTriggerOn.includes('clips'),
      snapshot: snapshotChange && eventsToTriggerOn.includes('snapshots'),
    });
  };

  protected async _subscribeToReviews(
    hass: HomeAssistant,
    frigateReviewWatcher: FrigateWatcherSubscriptionInterface<FrigateReviewChange>,
  ): Promise<void> {
    const config = this.getConfig();
    const reviewConfig = config.triggers.reviews;

    // Must have at least one severity configured and a camera name to subscribe
    if (!reviewConfig.severities.length || !config.frigate.camera_name) {
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

    await frigateReviewWatcher.subscribe(hass, request);
    this._onDestroy(() => frigateReviewWatcher.unsubscribe(request));
  }

  protected _frigateReviewHandler = (review: FrigateReviewChange): void => {
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
      fidelity: 'high',
      type: review.type,
      review: true,
    });
  };
}
