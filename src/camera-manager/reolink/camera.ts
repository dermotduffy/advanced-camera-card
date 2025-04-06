import { ActionsExecutor } from '../../card-controller/actions/types';
import { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { PTZCapabilities, PTZMovementType } from '../../types';
import { createSelectOptionAction } from '../../utils/action.js';
import { Entity, EntityRegistryManager } from '../../utils/ha/registry/entity/types';
import { BrowseMediaCamera } from '../browse-media/camera';
import { Camera, CameraInitializationOptions } from '../camera';
import { Capabilities } from '../capabilities';
import { CameraInitializationError } from '../error';
import { CameraProxyConfig } from '../types';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';

interface ReolinkCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  hass: HomeAssistant;
}

class ReolinkInitializationError extends CameraInitializationError {}

interface PTZEntities {
  stop?: string;
  left?: string;
  right?: string;
  up?: string;
  down?: string;
  zoom_in?: string;
  zoom_out?: string;
  presets?: string;
}
type PTZEntity = keyof PTZEntities;

export class ReolinkCamera extends BrowseMediaCamera {
  protected _channel: number | null = null;
  protected _reolinkUniqueID: string | null = null;
  protected _ptzEntities: PTZEntities | null = null;

  public async initialize(options: ReolinkCameraInitializationOptions): Promise<Camera> {
    await super.initialize(options);
    this._initializeChannel();
    await this._initializeCapabilities(options.hass, options.entityRegistryManager);
    return this;
  }

  protected _initializeChannel(): void {
    const uniqueID = this._entity?.unique_id;
    const match = uniqueID
      ? String(uniqueID).match(/(?<uniqueid>.*)_(?<channel>\d+)/)
      : null;

    const channel = match && match.groups?.channel ? Number(match.groups.channel) : null;
    const reolinkUniqueID = match?.groups?.uniqueid ?? null;

    if (channel === null || reolinkUniqueID === null) {
      throw new ReolinkInitializationError(
        localize('error.camera_initialization_reolink'),
        this.getConfig(),
      );
    }
    this._channel = channel;
    this._reolinkUniqueID = reolinkUniqueID;
  }

  protected async _initializeCapabilities(
    hass: HomeAssistant,
    entityRegistry: EntityRegistryManager,
  ): Promise<void> {
    const config = this.getConfig();
    const configPTZCapabilities = getPTZCapabilitiesFromCameraConfig(this.getConfig());
    const ptzEntities = await this._getPTZEntities(hass, entityRegistry);
    const reolinkPTZCapabilities = ptzEntities
      ? this._entitiesToCapabilities(hass, ptzEntities)
      : null;

    const combinedPTZCapabilities: PTZCapabilities | null =
      configPTZCapabilities || reolinkPTZCapabilities
        ? {
            ...reolinkPTZCapabilities,
            ...configPTZCapabilities,
          }
        : null;

    this._capabilities = new Capabilities(
      {
        'favorite-events': false,
        'favorite-recordings': false,
        'remote-control-entity': true,
        clips: true,
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
    this._ptzEntities = ptzEntities;
  }

  protected _entitiesToCapabilities(
    hass: HomeAssistant,
    ptzEntities: PTZEntities,
  ): PTZCapabilities | null {
    const reolinkPTZCapabilities: PTZCapabilities = {};
    for (const key of Object.keys(ptzEntities)) {
      switch (key) {
        case 'left':
        case 'right':
        case 'up':
        case 'down':
          reolinkPTZCapabilities[key] = [PTZMovementType.Continuous];
          break;
        case 'zoom_in':
          reolinkPTZCapabilities.zoomIn = [PTZMovementType.Continuous];
          break;
        case 'zoom_out':
          reolinkPTZCapabilities.zoomOut = [PTZMovementType.Continuous];
          break;
      }
    }

    const ptzPresetsEntityState = ptzEntities?.presets
      ? hass.states[ptzEntities.presets]
      : null;
    if (Array.isArray(ptzPresetsEntityState?.attributes.options)) {
      reolinkPTZCapabilities.presets = ptzPresetsEntityState.attributes.options;
    }

    /* istanbul ignore next: this path cannot be reached as ptzEntities will
    always have contents when this function is called  -- @preserve */
    return Object.keys(reolinkPTZCapabilities).length ? reolinkPTZCapabilities : null;
  }

  protected async _getPTZEntities(
    hass: HomeAssistant,
    entityRegistry: EntityRegistryManager,
  ): Promise<PTZEntities | null> {
    /* istanbul ignore next: this path cannot be reached as an exception is
       thrown in initialize() if this value is not found -- @preserve */
    if (!this._reolinkUniqueID) {
      return null;
    }

    const uniqueIDPrefix = `${this._reolinkUniqueID}_${this._channel}_`;
    const allRelevantEntities = await entityRegistry.getMatchingEntities(
      hass,
      (ent: Entity) =>
        ent.config_entry_id === this._entity?.config_entry_id &&
        !!ent.unique_id &&
        String(ent.unique_id).startsWith(uniqueIDPrefix) &&
        !ent.disabled_by,
    );
    const buttonEntities = allRelevantEntities.filter((ent: Entity) =>
      ent.entity_id.startsWith('button.'),
    );
    const ptzPresetEntities = allRelevantEntities.filter(
      (ent: Entity) =>
        ent.unique_id === `${uniqueIDPrefix}ptz_preset` &&
        ent.entity_id.startsWith('select.'),
    );

    const uniqueSuffixes: PTZEntity[] = [
      'stop',
      'left',
      'right',
      'up',
      'down',
      'zoom_in',
      'zoom_out',
    ];

    const ptzEntities: PTZEntities = {};
    for (const buttonEntity of buttonEntities) {
      for (const uniqueIDSuffix of uniqueSuffixes) {
        if (
          buttonEntity.unique_id &&
          String(buttonEntity.unique_id).endsWith(uniqueIDSuffix)
        ) {
          ptzEntities[uniqueIDSuffix] = buttonEntity.entity_id;
        }
      }
    }

    if (ptzPresetEntities.length === 1) {
      ptzEntities.presets = ptzPresetEntities[0].entity_id;
    }

    return Object.keys(ptzEntities).length ? ptzEntities : null;
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

    if (action === 'preset') {
      const entityID = this._ptzEntities.presets;
      const preset = options?.preset;
      if (!preset || !entityID) {
        return false;
      }

      await executor.executeActions({
        actions: [createSelectOptionAction('select', entityID, preset)],
      });
      return true;
    }

    const entityID =
      options?.phase === 'start'
        ? this._ptzEntities[action]
        : options?.phase === 'stop'
          ? this._ptzEntities.stop
          : null;
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
