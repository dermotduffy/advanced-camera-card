import { isEqual } from 'lodash-es';
import { isConfigUpgradeable } from '../../config/management.js';
import { setProfiles } from '../../config/profiles/set-profiles.js';
import {
  AdvancedCameraCardConfig,
  CardWideConfig,
  advancedCameraCardConfigSchema,
} from '../../config/schema/types.js';
import { RawAdvancedCameraCardConfig } from '../../config/types.js';
import { localize } from '../../localize/localize.js';
import { getParseErrorPaths } from '../../utils/zod.js';
import { InitializationAspect } from '../initialization-manager.js';
import { CardConfigAPI } from '../types.js';
import { setAutomationsFromConfig } from './load-automations.js';
import { setRemoteControlEntityFromConfig } from './load-control-entities.js';
import { setFoldersFromConfig } from './load-folders.js';
import { setKeyboardShortcutsFromConfig } from './load-keyboard-shortcuts.js';
import { OverridesManager } from './overrides-manager.js';

export class ConfigManager {
  protected _api: CardConfigAPI;

  // The main base configuration object. For most usecases use getConfig() to
  // get the correct configuration (which will return overrides as appropriate).
  // This variable must be called `_config` or `config` to be compatible with
  // card-mod.
  protected _config: AdvancedCameraCardConfig | null = null;
  protected _overriddenConfig: AdvancedCameraCardConfig | null = null;
  protected _rawConfig: RawAdvancedCameraCardConfig | null = null;
  protected _cardWideConfig: CardWideConfig | null = null;
  protected _overridesManager = new OverridesManager(() =>
    this._processOverrideConfig(),
  );

  constructor(api: CardConfigAPI) {
    this._api = api;
  }

  public hasConfig(): boolean {
    return !!this.getConfig();
  }

  public getConfig(): AdvancedCameraCardConfig | null {
    return this._overriddenConfig ?? this._config;
  }

  public getCardWideConfig(): CardWideConfig | null {
    return this._cardWideConfig;
  }

  public getNonOverriddenConfig(): AdvancedCameraCardConfig | null {
    return this._config;
  }

  public getRawConfig(): RawAdvancedCameraCardConfig | null {
    return this._rawConfig;
  }

  public setConfig(inputConfig?: RawAdvancedCameraCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('error.invalid_configuration'));
    }

    const parseResult = advancedCameraCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const configUpgradeable = isConfigUpgradeable(inputConfig);
      const hint = getParseErrorPaths(parseResult.error);
      let upgradeMessage = '';
      if (configUpgradeable) {
        upgradeMessage = `${localize('error.upgrade_available')}. `;
      }
      throw new Error(
        upgradeMessage +
          `${localize('error.invalid_configuration')}: ` +
          (hint && hint.size
            ? JSON.stringify([...hint], null, ' ')
            : localize('error.invalid_configuration_no_hint')),
      );
    }
    const config = setProfiles(inputConfig, parseResult.data, parseResult.data.profiles);

    this._rawConfig = inputConfig;
    if (isEqual(this._config, config)) {
      return;
    }

    this._config = config;
    this._cardWideConfig = {
      performance: config.performance,
      debug: config.debug,
    };

    this._overridesManager.set(
      this._api.getConditionStateManager(),
      this._config.overrides,
    );

    this._api.getConditionStateManager().setState({
      view: undefined,
      displayMode: undefined,
      camera: undefined,
    });
    this._api.getMediaLoadedInfoManager().clear();

    this._api.getInitializationManager().uninitialize(InitializationAspect.VIEW);
    this._api.getViewManager().reset();

    this._api.getMessageManager().reset();
    this._api.getStatusBarItemManager().removeAllDynamicStatusBarItems();

    this._processOverrideConfig();

    this._api.getCardElementManager().update();
  }

  protected _processOverrideConfig(): void {
    const overriddenConfig = this._getOverriddenConfig();

    // Save on Lit re-rendering costs by only updating the configuration if it
    // actually changes.
    if (!overriddenConfig || isEqual(overriddenConfig, this._overriddenConfig)) {
      return;
    }

    const previousConfig = this._overriddenConfig;
    this._overriddenConfig = overriddenConfig;

    setFoldersFromConfig(this._api);
    this._api.getStyleManager().updateFromConfig();

    // Ensure features that register automations or other side-effects from
    // configuration are updated when overrides change (e.g. remote_control).
    // Re-run loaders that may add/remove automations based on the current
    // effective configuration.
    setKeyboardShortcutsFromConfig(this._api);
    setRemoteControlEntityFromConfig(this._api);
    setAutomationsFromConfig(this._api);

    if (
      previousConfig &&
      (!isEqual(previousConfig?.cameras, this._overriddenConfig?.cameras) ||
        !isEqual(previousConfig?.cameras_global, this._overriddenConfig?.cameras_global))
    ) {
      this._api.getInitializationManager().uninitialize(InitializationAspect.CAMERAS);
      this._api.getCameraManager().destroy();
    }

    if (
      previousConfig &&
      previousConfig?.live.microphone.always_connected !==
        this._overriddenConfig?.live.microphone.always_connected
    ) {
      this._api
        .getInitializationManager()
        .uninitialize(InitializationAspect.MICROPHONE_CONNECT);
    }

    /* async */ this._initializeBackgroundAndUpdate(previousConfig);
  }

  protected _getOverriddenConfig(): AdvancedCameraCardConfig | null {
    /* istanbul ignore if: No (current) way to reach this code -- @preserve */
    if (!this._config) {
      return null;
    }

    try {
      return this._overridesManager.getConfig(this._config);
    } catch (ev) {
      this._api.getMessageManager().setErrorIfHigherPriority(ev);
      return null;
    }
  }

  /**
   * Initialize config dependent items in the background. For items that the
   * card hard requires, use InitializationManager instead.
   */
  protected async _initializeBackgroundAndUpdate(
    previousConfig: AdvancedCameraCardConfig | null,
  ): Promise<void> {
    await this._api.getDefaultManager().initializeIfNecessary(previousConfig);
    await this._api.getMediaPlayerManager().initializeIfNecessary(previousConfig);

    // The config is only set in the state if the card is already fully
    // initialized. If not, the config will be set post initialization in the
    // InitializationManager.
    if (
      this._overriddenConfig &&
      this._api.getInitializationManager().isInitializedMandatory()
    ) {
      this._api.getConditionStateManager().setState({
        config: this._overriddenConfig,
      });
    }

    this._api.getCardElementManager().update();
  }
}
