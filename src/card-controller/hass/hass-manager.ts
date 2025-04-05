import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { hasHAConnectionStateChanged } from '../../utils/ha';
import { CardHASSAPI } from '../types';
import { StateWatcher, StateWatcherSubscriptionInterface } from './state-watcher';

export class HASSManager {
  protected _hass: HomeAssistant | null = null;
  protected _api: CardHASSAPI;
  protected _stateWatcher: StateWatcher = new StateWatcher();

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
