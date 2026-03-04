import { hasHAConnectionStateChanged } from '../../ha/has-hass-connection-changed';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { log } from '../../utils/debug';
import { InitializationAspect } from '../initialization-manager';
import { CardHASSAPI } from '../types';
import { StateWatcher, StateWatcherSubscriptionInterface } from './state-watcher';

export class HASSManager {
  private _hass: HomeAssistant | null = null;
  private _api: CardHASSAPI;
  private _stateWatcher: StateWatcher = new StateWatcher();

  constructor(api: CardHASSAPI) {
    this._api = api;
  }

  public getHASS(): HomeAssistant | null {
    return this._hass;
  }

  public hasHASS(): boolean {
    return !!this._hass;
  }

  public getStateWatcher(): StateWatcherSubscriptionInterface {
    return this._stateWatcher;
  }

  public setHASS(hass?: HomeAssistant | null): void {
    if (hasHAConnectionStateChanged(this._hass, hass)) {
      if (!hass?.connected) {
        this._api.getMessageManager().setMessageIfHigherPriority({
          message: localize('error.reconnecting'),
          icon: 'mdi:lan-disconnect',
          type: 'connection',
          dotdotdot: true,
        });
      } else {
        this._api.getMessageManager().resetType('connection');

        // When the HA WebSocket connection is restored after a drop,
        // reinitialize cameras and the view. This is necessary because
        // event subscriptions (e.g. Frigate WebSocket subscriptions via
        // hass.connection.subscribeMessage) are tied to the old connection
        // and are lost when it drops. Without reinitialization, triggers
        // and thumbnail updates stop working.
        if (this._hass) {
          log(
            this._api.getConfigManager().getCardWideConfig(),
            'Advanced Camera Card: HA connection restored, reinitializing cameras',
          );

          this._api
            .getInitializationManager()
            .uninitialize(InitializationAspect.CAMERAS);
          this._api.getInitializationManager().uninitialize(InitializationAspect.VIEW);
          this._api
            .getInitializationManager()
            .uninitialize(InitializationAspect.INITIAL_TRIGGER);
        }
      }
    }

    if (!hass) {
      return;
    }

    const oldHass = this._hass;
    this._hass = hass;

    this._api.getConditionStateManager().setState({
      hass: this._hass,
    });

    // Theme may depend on HASS.
    this._api.getStyleManager().applyTheme();

    this._stateWatcher.setHASS(oldHass, hass);
  }
}
