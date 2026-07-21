import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { CONF_CAMERAS, CONF_FOLDERS, CONF_PROFILES } from '../../config/const';
import {
  addConfigArrayItem,
  copyConfig,
  deleteConfigArrayItem,
  getConfigValue,
  isConfigUpgradeable,
  moveConfigArrayItem,
  upgradeConfig,
} from '../../config/management';
import { setProfiles } from '../../config/profiles/set-profiles';
import { profilesSchema, type ProfileType } from '../../config/schema/profiles';
import { configDefaults } from '../../config/schema/types';
import type {
  RawAdvancedCameraCardConfig,
  RawAdvancedCameraCardConfigArray,
} from '../../config/types';
import { fireHASSEvent } from '../../ha/fire-hass-event';
import { sideLoadHomeAssistantElements } from '../../ha/side-load-ha-elements';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { errorToConsole, isRecord } from '../../utils/basic';
import { getCameraID } from '../../utils/camera';
import { getFolderID } from '../../utils/folder';
import { applyConfigChanges } from './form-data';
import type { FormsInput } from './forms-controller';
import type { EditorIntent } from './intents';
import type { FormRequestOptions } from './schema/registry';
import { getEditorCameraTitle, getEditorFolderTitle } from './titles';

type EditorControllerHost = ReactiveControllerHost & EventTarget;

// A card-state notice the editor shows as a banner above the sections.
interface EditorNotice {
  type: 'info' | 'warning';
  message: string;
}

// Interpret a raw configuration value as an array of configuration objects.
// Non-object entries become empty objects rather than being dropped, so that
// list indices always match the configuration's own indices (editor edits
// address items by index).
const toConfigArray = (value: unknown): RawAdvancedCameraCardConfigArray =>
  Array.isArray(value) ? value.map((entry) => (isRecord(entry) ? entry : {})) : [];

/**
 * The editor's view of the card configuration: its contents, the defaults an
 * unset field falls back to, and anything about it worth telling the user.
 * The sections read the configuration through here and report back what the
 * user asked to do; this is the only place that changes it.
 */
export class EditorController implements ReactiveController {
  private _host: EditorControllerHost;

  // Note: The configuration is not parsed with Zod, so it may be partially or
  // completely invalid. A partially valid configuration is more useful than
  // none, to allow the user to fix the broken parts.
  private _config: RawAdvancedCameraCardConfig | null = null;

  // The defaults shown for unset fields; profiles change them.
  private _defaults = copyConfig(configDefaults);

  private _configUpgradeable = false;
  private _initialized = false;
  private _hass?: HomeAssistant;

  // The parsed configuration profiles (empty when unset or invalid).
  private _profiles: ProfileType[] = [];

  constructor(host: EditorControllerHost) {
    this._host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    // No connection-time work.
  }

  // Load the Home Assistant elements the editor renders. A failure leaves the
  // editor with degraded form elements and is retried on the next update; it
  // is logged so the cause is at least visible.
  public initialize(): void {
    if (this._initialized) {
      return;
    }
    sideLoadHomeAssistantElements()
      .then(() => {
        this._initialized = true;
      })
      .catch((e) => errorToConsole(e));
  }

  public setConfig(config: RawAdvancedCameraCardConfig): void {
    this._applyConfig(config);
    this._host.requestUpdate();
  }

  // Adopt a configuration and derive everything that depends on it. Used for
  // both an externally supplied configuration and an edit made in the editor,
  // such that the two cannot diverge.
  private _applyConfig(config: RawAdvancedCameraCardConfig): void {
    this._config = config;
    this._configUpgradeable = isConfigUpgradeable(config);

    // The defaults are rebuilt from scratch so that removing (or breaking) a
    // profile also removes its adjusted defaults.
    const profiles = profilesSchema.safeParse(getConfigValue(config, CONF_PROFILES));
    this._profiles = profiles.success ? profiles.data ?? [] : [];
    const defaults = copyConfig(configDefaults);
    if (profiles.success) {
      setProfiles(config, defaults, profiles.data);
    }
    this._defaults = defaults;
  }

  public getNotices(): EditorNotice[] {
    const notices: EditorNotice[] = [];

    if (this._profiles.includes('low-performance')) {
      notices.push({
        type: 'warning',
        message: localize('config.performance.warning'),
      });
    }

    const overrides = this._config?.['overrides'];
    if (Array.isArray(overrides) && overrides.length) {
      notices.push({ type: 'info', message: localize('config.overrides.info') });
    }
    return notices;
  }

  public getConfig(): RawAdvancedCameraCardConfig | null {
    return this._config;
  }

  public getDefaults(): RawAdvancedCameraCardConfig {
    return this._defaults;
  }

  /**
   * Get what a section needs to show its forms: the configuration the forms
   * display, the defaults an unset field falls back to, and the lists its
   * dropdowns choose from (the entities, the cameras a camera may depend on,
   * the folders its media may come from).
   * @returns The section input.
   */
  public getFormsInput(): FormsInput {
    return {
      config: this._config ?? {},
      defaults: this._defaults,
      options: this._getFormRequestOptions(),
    };
  }

  private _getFormRequestOptions(): FormRequestOptions {
    return {
      cameras: this.getCameras().map((camera, index) => ({
        value: getCameraID(camera),
        label: getEditorCameraTitle(index, camera, this._hass),
      })),
      folders: this.getFolders().map((folder, index) => ({
        value: getFolderID(folder, index),
        label: getEditorFolderTitle(index, folder),
      })),
    };
  }

  public setHASS(hass: HomeAssistant): void {
    this._hass = hass;
  }

  public getHASS(): HomeAssistant | undefined {
    return this._hass;
  }

  public isConfigUpgradeable(): boolean {
    return this._configUpgradeable;
  }

  public upgrade(): void {
    this._modifyConfig(upgradeConfig);
  }

  public getCameras(): RawAdvancedCameraCardConfigArray {
    return toConfigArray(getConfigValue(this._config ?? {}, CONF_CAMERAS));
  }

  public getFolders(): RawAdvancedCameraCardConfigArray {
    return toConfigArray(getConfigValue(this._config ?? {}, CONF_FOLDERS));
  }

  /**
   * Carry out what a section reported the user asked for. Every path an intent
   * carries is absolute, so nothing here needs to know which section it came
   * from.
   * @param intent What the user asked to do.
   */
  public applyIntent(intent: EditorIntent): void {
    if (!this._config) {
      return;
    }
    switch (intent.type) {
      case 'changes': {
        const newConfig = applyConfigChanges(this._config, intent.changes);
        if (newConfig) {
          this._updateConfig(newConfig);
        }
        return;
      }
      case 'list-add':
        this._modifyConfig((config) =>
          addConfigArrayItem(config, intent.path, intent.item),
        );
        return;
      case 'list-move':
        this._modifyConfig((config) =>
          moveConfigArrayItem(config, intent.path, intent.from, intent.to),
        );
        return;
      case 'list-delete':
        this._modifyConfig((config) =>
          deleteConfigArrayItem(config, intent.path, intent.index),
        );
        return;
    }
  }

  private _modifyConfig(func: (config: RawAdvancedCameraCardConfig) => boolean): void {
    if (this._config) {
      const newConfig = copyConfig(this._config);
      if (func(newConfig)) {
        this._updateConfig(newConfig);
      }
    }
  }

  private _updateConfig(config: RawAdvancedCameraCardConfig): void {
    this._applyConfig(config);
    this._host.requestUpdate();
    fireHASSEvent(this._host, 'config-changed', { config });
  }
}
