import { ActionsExecutor } from '../../card-controller/actions/types';
import { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import { DeviceRegistryManager } from '../../ha/registry/device/index';
import { Entity, EntityRegistryManager } from '../../ha/registry/entity/types';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import {
  CapabilitiesRaw,
  Endpoint,
  PTZCapabilities,
  PTZMovementType,
} from '../../types';
import { createSelectOptionAction } from '../../utils/action.js';
import { Camera, CameraInitializationOptions } from '../camera';
import { EntityCamera } from '../entity-camera';
import { CameraInitializationError } from '../error';
import { CameraEndpointsContext, CameraProxyConfig } from '../types';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';

// Reolink channels are zero indexed.
const REOLINK_DEFAULT_CHANNEL = 0;

interface ReolinkCameraInitializationOptions extends CameraInitializationOptions {
  entityRegistryManager: EntityRegistryManager;
  deviceRegistryManager: DeviceRegistryManager;
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

export class ReolinkCamera extends EntityCamera {
  // The HostID identifying the camera or NVR.
  protected _reolinkHostID: string | null = null;

  // For NVRs, the Camera UID.
  protected _reolinkCameraUID: string | null = null;

  // The channel number as used by the Reolink integration.
  protected _reolinkChannel: number | null = null;

  // Entities used for PTZ control.
  protected _ptzEntities: PTZEntities | null = null;

  /**
   * Reolink cameras require additional options not present in the base class
   * initialization options, so this ~empty method is used to expand the type
   * expectations. Without this, callers cannot specify objects (e.g. the device
   * registry) without TypeScript errors.
   */
  public async initialize(options: ReolinkCameraInitializationOptions): Promise<Camera> {
    return super.initialize(options);
  }

  protected async _getChannelFromConfigurationURL(
    hass: HomeAssistant,
    deviceRegistryManager: DeviceRegistryManager,
  ): Promise<number | null> {
    const deviceID = this._entity?.device_id;
    if (!deviceID) {
      return null;
    }
    const device = await deviceRegistryManager.getDevice(hass, deviceID);
    if (!device?.configuration_url) {
      return null;
    }
    try {
      const url = new URL(device.configuration_url);
      const channel = Number(url.searchParams.get('ch'));
      return isNaN(channel) ? null : channel;
    } catch {
      // Ignore invalid URLs.
      return null;
    }
  }

  protected async _initializeChannel(
    hass: HomeAssistant,
    deviceRegistryManager: DeviceRegistryManager,
  ): Promise<void> {
    const uniqueID = this._entity?.unique_id;

    // Reolink camera unique IDs are dual-mode, they may be in either of these
    // forms:
    //  - Directly connected cameras: [HostID]_[Channel #]_[...]
    //    (e.g. `95270002FS8D4RUP_0_sub`)
    //  - NVR/Hub connected cameras: [HostID]_[Camera UID]_[...]
    //    (e.g. `9527000HXU4V1VHZ_9527000I7E5F1GYU_sub`)
    //
    // The channel number is always numeric and assumed to be <1000, see similar
    // comparisons in the integration itself:
    // https://github.com/home-assistant/core/blob/dev/homeassistant/components/reolink/media_source.py#L174
    //
    // In the latter form, the channel number cannot be inferred from the entity
    // and must only be taken from the user config instead.

    const match = uniqueID
      ? String(uniqueID).match(/^(?<hostid>[^_]+)_(?<channel_or_uid>[^_]+)_/)
      : null;

    const hostid = match?.groups?.hostid ?? null;
    const channelOrUID = match?.groups?.channel_or_uid ?? null;

    if (hostid === null || channelOrUID === null) {
      throw new ReolinkInitializationError(
        localize('error.camera_initialization_reolink'),
        this.getConfig(),
      );
    }

    const channelCandidate = Number(channelOrUID);
    const isValidChannel = !isNaN(channelCandidate) && channelCandidate <= 999;
    const channel =
      // Channel from the unique ID itself (for directly connected cameras).
      (isValidChannel ? channelCandidate : null) ??
      // Channel from the configuration URL (for NVRs where the entity unique
      // id is based on the UID).
      (await this._getChannelFromConfigurationURL(hass, deviceRegistryManager)) ??
      // Fallback.
      REOLINK_DEFAULT_CHANNEL;

    const reolinkCameraUID = !isValidChannel ? channelOrUID : null;

    this._reolinkChannel = channel;
    this._reolinkHostID = hostid;
    this._reolinkCameraUID = reolinkCameraUID;
  }

  protected async _initialize(
    options: ReolinkCameraInitializationOptions,
  ): Promise<void> {
    await this._initializeChannel(options.hass, options.deviceRegistryManager);
    this._ptzEntities = await this._getPTZEntities(
      options.hass,
      options.entityRegistryManager,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected override _getUIEndpoint(_context?: CameraEndpointsContext): Endpoint | null {
    return this._config.reolink?.url ? { endpoint: this._config.reolink.url } : null;
  }

  protected async _getRawCapabilities(
    options: ReolinkCameraInitializationOptions,
  ): Promise<CapabilitiesRaw> {
    const configPTZ = getPTZCapabilitiesFromCameraConfig(this.getConfig());
    const reolinkPTZ = this._ptzEntities
      ? this._entitiesToCapabilities(options.hass, this._ptzEntities)
      : null;

    const combinedPTZ: PTZCapabilities | null =
      configPTZ || reolinkPTZ ? { ...reolinkPTZ, ...configPTZ } : null;

    return {
      ...(await super._getRawCapabilities(options)),
      clips: true,
      ...(combinedPTZ && { ptz: combinedPTZ }),
    };
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
    if (!this._reolinkHostID) {
      return null;
    }

    const uniqueIDPrefix = this._getPTZEntityUniqueIDPrefix();
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
    return this._reolinkChannel;
  }

  protected _getPTZEntityUniqueIDPrefix(): string {
    return `${this._reolinkHostID}_${this._reolinkCameraUID ?? this._reolinkChannel}_`;
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
