import { isHassReady } from '../../ha/is-hass-ready';
import { HASSListener, HASSUnlistenCallback } from '../../ha/source';
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

  private _stateWatcher: StateWatcherSubscriptionInterface;
  private _eventWatcher: EventWatcherSubscriptionInterface;

  constructor(api: CardHASSAPI) {
    this._api = api;
    this._stateWatcher = new StateWatcher(this);
    this._eventWatcher = new EventWatcher(this);
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
    // When HA goes from "not ready" to "ready" (WebSocket reconnected AND all
    // integrations finished loading), rebuild cameras and the view from
    // scratch: the available entities may have changed while it was down.
    const becameReady = !!this._hass && !isHassReady(this._hass) && isHassReady(hass);

    if (becameReady) {
      // Tear cameras down before the listeners below see the new hass,
      // otherwise they would briefly rebuild against the old entities.
      log(
        this._api.getConfigManager().getCardWideConfig(),
        'Advanced Camera Card: HA fully ready, reinitializing...',
      );

      this._api.getInitializationManager().uninitialize(InitializationAspect.CAMERAS);
      void this._api.getCameraManager().destroy();
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

    // Notify each listener of the new hass, in subscription order.
    for (const listener of this._hassListeners) {
      listener(hass, oldHass);
    }

    // Try to (re)initialize whenever hass changes. Initialization normally
    // happens on the next re-render, but the teardown above can leave a
    // reconnected card without a re-render, so it could stay stuck
    // uninitialized. Harmless no-op when already initialized or not yet ready.
    this._api.getInitializationManager().triggerInitialization();
  }
}
