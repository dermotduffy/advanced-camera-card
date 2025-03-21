import isEqual from 'lodash-es/isEqual';
import { AdvancedCameraCardConfig } from '../config/schema/types';
import { createGeneralAction } from '../utils/action';
import { isActionAllowedBasedOnInteractionState } from '../utils/interaction-mode';
import { Timer } from '../utils/timer';
import { CardDefaultManagerAPI } from './types';

/**
 * Manages automated resetting to the default view.
 */
export class DefaultManager {
  protected _timer = new Timer();
  protected _api: CardDefaultManagerAPI;

  constructor(api: CardDefaultManagerAPI) {
    this._api = api;
  }

  public async initializeIfNecessary(
    previousConfig: AdvancedCameraCardConfig | null,
  ): Promise<void> {
    if (
      !isEqual(
        previousConfig?.view.default_reset,
        this._api.getConfigManager().getConfig()?.view.default_reset,
      )
    ) {
      await this.initialize();
    }
  }

  /**
   * This needs to be public since the first initialization requires both hass
   * and the config, so it is not suitable from calling exclusively from the
   * config manager.
   */
  public async initialize(): Promise<boolean> {
    this.uninitialize();

    const config = this._api.getConfigManager().getConfig()?.view.default_reset;
    if (config?.entities.length) {
      this._api
        .getHASSManager()
        .getStateWatcher()
        .subscribe(this._stateChangeHandler, config.entities);
    }

    const timerSeconds = this._api.getConfigManager().getConfig()?.view
      .default_reset.every_seconds;
    if (timerSeconds) {
      this._timer.startRepeated(timerSeconds, () => this._setToDefaultIfAllowed());
    }

    if (this._api.getConfigManager().getConfig()?.view.default_reset.after_interaction) {
      this._api.getAutomationsManager().addAutomations([
        {
          actions: [createGeneralAction('default')],
          conditions: [
            {
              condition: 'interaction' as const,
              interaction: false,
            },
          ],
          tag: this,
        },
      ]);
    }

    return true;
  }

  public uninitialize(): void {
    this._timer.stop();
    this._api.getHASSManager().getStateWatcher().unsubscribe(this._stateChangeHandler);
    this._api.getAutomationsManager().deleteAutomations(this);
  }

  protected _stateChangeHandler = (): void => {
    this._setToDefaultIfAllowed();
  };

  protected _setToDefaultIfAllowed(): void {
    if (this._isAutomatedUpdateAllowed()) {
      this._api.getViewManager().setViewDefault();
    }
  }

  protected _isAutomatedUpdateAllowed(): boolean {
    const interactionMode = this._api.getConfigManager().getConfig()?.view
      .default_reset.interaction_mode;
    return (
      !!interactionMode &&
      isActionAllowedBasedOnInteractionState(
        interactionMode,
        this._api.getInteractionManager().hasInteraction(),
      )
    );
  }
}
