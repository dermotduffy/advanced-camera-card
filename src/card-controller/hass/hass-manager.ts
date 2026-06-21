import { HASSListener, HASSUnlistenCallback } from '../../ha/source';
import { isHassReady } from '../../ha/is-hass-ready';
import { HomeAssistant } from '../../ha/types';
import { log } from '../../utils/debug';
import { InitializationAspect } from '../initialization-manager';
import { CardHASSAPI } from '../types';
import { EventWatcher, EventWatcherSubscriptionInterface } from './event-watcher';
import { StateWatcher, StateWatcherSubscriptionInterface } from './state-watcher';
import { HASSManagerReadonlyInterface } from './types';

export class HASSManager implements HASSManagerReadonlyInterface {
  private _hass: HomeAssistant | null = null;
  private _api: CardHASSAPI;

  private _hassListeners = new Set<HASSListener>();

  private _stateWatcher: StateWatcher = new StateWatcher(this);
  private _eventWatcher: EventWatcher = new EventWatcher(this);

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

  public getEventWatcher(): EventWatcherSubscriptionInterface {
    return this._eventWatcher;
  }

  public addListener(listener: HASSListener): HASSUnlistenCallback {
    this._hassListeners.add(listener);
    return () => {
      this._hassListeners.delete(listener);
    };
  }

  public setHASS(hass?: HomeAssistant | null): void {
    // When HA transitions from "not ready" to "ready" (WebSocket reconnected
    // AND all integrations finished loading), reinitialize cameras and the
    // view. The entity world may change across reconnects, so a full re-init is
    // a correctness requirement. Stays as a direct call (before fan-out)
    // because cameras must tear down before any listener observes the new hass,
    // or they'd briefly re-init against the old world.
    if (this._hass && !isHassReady(this._hass) && isHassReady(hass)) {
      log(
        this._api.getConfigManager().getCardWideConfig(),
        'Advanced Camera Card: HA fully ready, reinitializing...',
      );

      this._api.getInitializationManager().uninitialize(InitializationAspect.CAMERAS);
      this._api.getCameraManager().destroy();
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

    // Fan out to source listeners in insertion order.
    for (const listener of this._hassListeners) {
      listener(hass, oldHass);
    }
  }
}
