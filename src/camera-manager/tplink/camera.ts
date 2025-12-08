import { ActionsExecutor } from '../../card-controller/actions/types';
import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import { HomeAssistant } from '../../ha/types';
import { PTZCapabilities, PTZMovementType } from '../../types';
import { Camera } from '../camera';
import { Capabilities } from '../capabilities';
import { EntityCamera, EntityCameraInitializationOptions } from '../entity-camera';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';

type TPLinkCameraInitializationOptions = EntityCameraInitializationOptions;

interface PTZEntities {
  left?: string;
  right?: string;
  up?: string;
  down?: string;
}
type PTZEntity = keyof PTZEntities;

export class TPLinkCamera extends EntityCamera {
  protected _ptzEntities: PTZEntities | null = null;

  public async initialize(options: TPLinkCameraInitializationOptions): Promise<Camera> {
    await super.initialize(options);
    await this._initializeCapabilities(
      options.hass,
      options.entityRegistryManager,
      options.stateWatcher,
    );
    return this;
  }

  protected async _initializeCapabilities(
    hass: HomeAssistant,
    entityRegistry: EntityRegistryManager,
    stateWatcher: StateWatcherSubscriptionInterface,
  ): Promise<void> {
    const config = this.getConfig();
    const configPTZCapabilities = getPTZCapabilitiesFromCameraConfig(config);
    this._ptzEntities = await this._getPTZEntities(hass, entityRegistry);
    const tplinkPTZCapabilities = this._ptzEntities
      ? this._entitiesToCapabilities(this._ptzEntities)
      : null;

    const combinedPTZCapabilities: PTZCapabilities | null =
      configPTZCapabilities || tplinkPTZCapabilities
        ? {
            ...tplinkPTZCapabilities,
            ...configPTZCapabilities,
          }
        : null;

    this._capabilities = new Capabilities(
      {
        'favorite-events': false,
        'favorite-recordings': false,
        'remote-control-entity': true,
        clips: false,
        live: true,
        menu: true,
        recordings: false,
        seek: false,
        snapshots: false,
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

  protected async _getPTZEntities(
    hass: HomeAssistant,
    entityRegistry: EntityRegistryManager,
  ): Promise<PTZEntities | null> {
    if (!this._entity?.device_id) {
      return null;
    }

    // Find all button entities on the same device
    const buttonEntities = await entityRegistry.getMatchingEntities(
      hass,
      (ent: Entity) =>
        ent.device_id === this._entity?.device_id &&
        ent.entity_id.startsWith('button.') &&
        !ent.disabled_by,
    );

    // TPLink uses pan_right, pan_left, tilt_up, tilt_down button entity suffixes
    const entitySuffixToAction: Record<string, PTZEntity> = {
      pan_left: 'left',
      pan_right: 'right',
      tilt_up: 'up',
      tilt_down: 'down',
    };

    const ptzEntities: PTZEntities = {};
    for (const buttonEntity of buttonEntities) {
      for (const [suffix, action] of Object.entries(entitySuffixToAction)) {
        if (buttonEntity.entity_id.endsWith(`_${suffix}`)) {
          ptzEntities[action] = buttonEntity.entity_id;
        }
      }
    }

    return Object.keys(ptzEntities).length ? ptzEntities : null;
  }

  protected _entitiesToCapabilities(ptzEntities: PTZEntities): PTZCapabilities {
    const tplinkPTZCapabilities: PTZCapabilities = {};
    // TPLink buttons perform relative movements (no stop button needed)
    for (const key of Object.keys(ptzEntities) as PTZEntity[]) {
      tplinkPTZCapabilities[key] = [PTZMovementType.Relative];
    }
    return tplinkPTZCapabilities;
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

    if (!this._ptzEntities) {
      return false;
    }

    // TPLink doesn't support presets
    if (action === 'preset') {
      return false;
    }

    // TPLink doesn't have zoom capabilities
    if (action === 'zoom_in' || action === 'zoom_out') {
      return false;
    }

    // TPLink doesn't have a stop button - the camera stops when the button
    // press action completes. We return true to indicate the stop was "handled"
    // (even though no action is actually taken).
    if (options?.phase === 'stop') {
      return true;
    }

    const entityID = this._ptzEntities[action];
    if (!entityID) {
      return false;
    }

    await executor.executeActions({
      actions: [
        {
          action: 'perform-action',
          perform_action: 'button.press',
          target: { entity_id: entityID },
        },
      ],
    });
    return true;
  }
}
