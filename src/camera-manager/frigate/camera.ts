import { uniq } from 'lodash-es';
import { ActionsExecutor } from '../../card-controller/actions/types';
import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import { CameraConfig } from '../../config/schema/cameras';
import { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { PTZCapabilities, PTZMovementType } from '../../types';
import { errorToConsole } from '../../utils/basic';
import { Camera, CameraInitializationOptions } from '../camera';
import { Capabilities } from '../capabilities';
import { CameraManagerEngine } from '../engine';
import { CameraInitializationError } from '../error';
import { CameraEventCallback } from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';
import {
  FrigateEventWatcherRequest,
  FrigateEventWatcherSubscriptionInterface,
} from './event-watcher';
import { getPTZInfo } from './requests';
import { FrigateEventChange, PTZInfo } from './types';

const CAMERA_BIRDSEYE = 'birdseye' as const;

interface FrigateCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  frigateEventWatcher: FrigateEventWatcherSubscriptionInterface;
  hass: HomeAssistant;
  stateWatcher: StateWatcherSubscriptionInterface;
}

export const isBirdseye = (cameraConfig: CameraConfig): boolean => {
  return cameraConfig.frigate.camera_name === CAMERA_BIRDSEYE;
};

export class FrigateCamera extends Camera {
  constructor(
    config: CameraConfig,
    engine: CameraManagerEngine,
    options?: {
      capabilities?: Capabilities;
      eventCallback?: CameraEventCallback;
    },
  ) {
    super(config, engine, options);
  }

  public async initialize(options: FrigateCameraInitializationOptions): Promise<Camera> {
    await this._initializeConfig(options.hass, options.entityRegistryManager);
    await this._initializeCapabilities(options.hass, options.stateWatcher);

    if (this._capabilities?.has('trigger')) {
      await this._subscribeToEvents(options.hass, options.frigateEventWatcher);
    }

    return await super.initialize(options);
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

  protected async _initializeCapabilities(
    hass: HomeAssistant,
    stateWatcher: StateWatcherSubscriptionInterface,
  ): Promise<void> {
    const config = this.getConfig();

    const configPTZCapabilities = getPTZCapabilitiesFromCameraConfig(this.getConfig());
    const frigatePTZCapabilities = await this._getPTZCapabilities(hass, config);

    const combinedPTZCapabilities: PTZCapabilities | null =
      configPTZCapabilities || frigatePTZCapabilities
        ? {
            ...frigatePTZCapabilities,
            ...configPTZCapabilities,
          }
        : null;

    const birdseye = isBirdseye(config);
    this._capabilities = new Capabilities(
      {
        'favorite-events': !birdseye,
        'favorite-recordings': false,
        'remote-control-entity': true,
        seek: !birdseye,
        clips: !birdseye,
        snapshots: !birdseye,
        recordings: !birdseye,
        live: true,
        menu: true,
        substream: true,
        trigger: true,
        ...(combinedPTZCapabilities && { ptz: combinedPTZCapabilities }),
      },
      {
        disable: config.capabilities?.disable,
        disableExcept: config.capabilities?.disable_except,
      },
    );
    this._subscribeBasedOnCapabilities(stateWatcher);
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
        ...(panTilt && {
          left: panTilt,
          right: panTilt,
          up: panTilt,
          down: panTilt,
        }),
        ...(zoom && { zoomIn: zoom, zoomOut: zoom }),
        ...(presets && { presets: presets }),
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
    frigateEventWatcher: FrigateEventWatcherSubscriptionInterface,
  ): Promise<void> {
    const config = this.getConfig();
    if (!config.triggers.events.length || !config.frigate.camera_name) {
      return;
    }

    /* istanbul ignore next -- exercising the matcher is not possible when the
    test uses an event watcher -- @preserve */
    const request: FrigateEventWatcherRequest = {
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
      fidelity: 'high',
      cameraID: this.getID(),
      type: ev.type,
      // In cases where there are both clip and snapshot media, ensure to only
      // trigger on the media type that is allowed by the configuration.
      clip: clipChange && eventsToTriggerOn.includes('clips'),
      snapshot: snapshotChange && eventsToTriggerOn.includes('snapshots'),
    });
  };
}
