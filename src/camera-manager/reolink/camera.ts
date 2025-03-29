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

interface PTZButtonEntities {
  stop?: string;
  left?: string;
  right?: string;
  up?: string;
  down?: string;
  zoom_in?: string;
  zoom_out?: string;
}
type PTZButton = keyof PTZButtonEntities;

export class ReolinkCamera extends BrowseMediaCamera {
  protected _channel: number | null = null;
  protected _reolinkUniqueID: string | null = null;
  protected _ptzButtons: PTZButtonEntities | null = null;

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

    const ptzButtons = await this._getPTZButtons(hass, entityRegistry);
    const configPTZCapabilities = getPTZCapabilitiesFromCameraConfig(this.getConfig());

    const reolinkPTZCapabilities: PTZCapabilities = {};
    for (const key of Object.keys(ptzButtons ?? {})) {
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

    const combinedPTZCapabilities: PTZCapabilities | null =
      configPTZCapabilities || Object.keys(reolinkPTZCapabilities).length
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
    this._ptzButtons = ptzButtons;
  }

  protected async _getPTZButtons(
    hass: HomeAssistant,
    entityRegistry: EntityRegistryManager,
  ): Promise<PTZButtonEntities | null> {
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

    const uniqueSuffixes: PTZButton[] = [
      'stop',
      'left',
      'right',
      'up',
      'down',
      'zoom_in',
      'zoom_out',
    ];

    const buttons: PTZButtonEntities = {};
    for (const buttonEntity of buttonEntities) {
      for (const uniqueIDSuffix of uniqueSuffixes) {
        if (
          buttonEntity.unique_id &&
          String(buttonEntity.unique_id).endsWith(uniqueIDSuffix)
        ) {
          buttons[uniqueIDSuffix] = buttonEntity.entity_id;
        }
      }
    }

    return Object.keys(buttons).length ? buttons : null;
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
