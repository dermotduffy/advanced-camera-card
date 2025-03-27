import { ActionsExecutor } from '../../card-controller/actions/types';
import { PTZAction, PTZActionPhase } from '../../config/schema/actions/custom/ptz';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { PTZCapabilities, PTZMovementType } from '../../types';
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

interface PTZActionToButtonEntity {
  stop?: string;
  left?: string;
  right?: string;
  up?: string;
  down?: string;
  zoomIn?: string;
  zoomOut?: string;
}

export class ReolinkCamera extends BrowseMediaCamera {
  protected _channel: number | null = null;
  protected _reolinkUniqueID: string | null = null;
  protected _ptzButtons: PTZActionToButtonEntity | null = null;

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

    const ptzButtonMap = await this._getPTZButtonEntities(hass, entityRegistry);
    const configPTZCapabilities = getPTZCapabilitiesFromCameraConfig(this.getConfig());
    const reolinkPTZCapabilities = ptzButtonMap
      ? Object.keys(ptzButtonMap).reduce(
          (acc, key) =>
            key === 'stop' ? acc : { [key]: [PTZMovementType.Continuous], ...acc },
          {},
        )
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
    this._ptzButtons = ptzButtonMap;
  }

  protected async _getPTZButtonEntities(
    hass: HomeAssistant,
    entityRegistry: EntityRegistryManager,
  ): Promise<PTZActionToButtonEntity | null> {
    /* istanbul ignore next: this path cannot be reached as an exception is
       thrown in initialize() if this value is not found -- @preserve */
    if (!this._reolinkUniqueID) {
      return null;
    }

    const uniqueIDPrefix = `${this._reolinkUniqueID}_${this._channel}_`;
    const buttonEntities = await entityRegistry.getMatchingEntities(
      hass,
      (ent: Entity) =>
        ent.config_entry_id === this._entity?.config_entry_id &&
        !!ent.unique_id &&
        String(ent.unique_id).startsWith(uniqueIDPrefix) &&
        !ent.disabled_by &&
        ent.entity_id.startsWith('button.'),
    );

    const capabilityMap = {
      _ptz_stop: 'stop',
      _ptz_left: 'left',
      _ptz_right: 'right',
      _ptz_up: 'up',
      _ptz_down: 'down',
      _ptz_zoom_in: 'zoomIn',
      _ptz_zoom_out: 'zoomOut',
    };

    const buttonMap: PTZActionToButtonEntity = {};
    for (const buttonEntity of buttonEntities) {
      for (const [uniqueIDSuffix, capability] of Object.entries(capabilityMap)) {
        if (
          buttonEntity.unique_id &&
          String(buttonEntity.unique_id).endsWith(uniqueIDSuffix)
        ) {
          buttonMap[capability] = buttonEntity.entity_id;
        }
      }
    }

    return Object.keys(buttonMap).length ? buttonMap : null;
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

    const entityID =
      options?.phase === 'start'
        ? this._ptzButtons?.[action]
        : options?.phase === 'stop'
          ? this._ptzButtons?.stop
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
