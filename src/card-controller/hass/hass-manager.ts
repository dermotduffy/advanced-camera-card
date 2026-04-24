import { STATE_RUNNING } from 'home-assistant-js-websocket';
import { HomeAssistant } from '../../ha/types';
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
    // When HA transitions from "not ready" to "ready" (WebSocket reconnected
    // AND all integrations finished loading), reinitialize cameras and the
    // view. This is necessary because event subscriptions (e.g. Frigate
    // WebSocket subscriptions via hass.connection.subscribeMessage) are tied to
    // the old connection and are lost when it drops. Without reinitialization,
    // triggers and thumbnail updates stop working.
    //
    // We deliberately wait for hass.config.state === STATE_RUNNING rather than
    // just hass.connected, because HA exposes the WebSocket before integrations
    // have finished loading. Triggering re-init too early would race against
    // integration startup and fail with "Unknown command" on
    // integration-specific WS calls.
    if (this._hass && !this._isReady(this._hass) && this._isReady(hass)) {
      log(
        this._api.getConfigManager().getCardWideConfig(),
        'Advanced Camera Card: HA fully ready, reinitializing...',
      );

      this._api.getInitializationManager().uninitialize(InitializationAspect.CAMERAS);
      this._api.getInitializationManager().uninitialize(InitializationAspect.VIEW);
      this._api
        .getInitializationManager()
        .uninitialize(InitializationAspect.INITIAL_TRIGGER);
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

  private _isReady(hass?: HomeAssistant | null): boolean {
    return !!hass?.connected && hass.config?.state === STATE_RUNNING;
  }
}
