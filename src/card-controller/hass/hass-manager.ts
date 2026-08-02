import { isHassReady } from '../../ha/is-hass-ready';
import type { HASSListener } from '../../ha/source';
import type { HomeAssistant } from '../../ha/types';
import type { UnsubscribeCallback } from '../../types';
import { log } from '../../utils/debug';
import { InitializationAspect } from '../initialization/initialization-manager';
import type { CardHASSAPI } from '../types';
import { EventWatcher, type EventWatcherSubscriptionInterface } from './event-watcher';
import { StateWatcher, type StateWatcherSubscriptionInterface } from './state-watcher';
import type { HASSManagerReadonlyInterface } from './types';

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

  public addListener(listener: HASSListener): UnsubscribeCallback {
    this._hassListeners.add(listener);
    return () => {
      this._hassListeners.delete(listener);
    };
  }

  public setHASS(hass?: HomeAssistant | null): void {
    // No hass at all is an absence of news rather than a change, so nothing
    // below it runs and `_hass` keeps whatever it last held.
    if (!hass) {
      return;
    }

    const wasReady = !!this._hass && isHassReady(this._hass);
    const isReady = isHassReady(hass);

    // A card cannot be started without Home Assistant, so losing it ends the
    // card's initialization session. The aspects initialized during that
    // session are left in place until it returns, when they are initialized
    // again against whatever entities it comes back with.
    if (wasReady && !isReady) {
      this._api.getInitializationManager().getSessionManager().end();
    }

    // When HA goes from "not ready" to "ready" (WebSocket reconnected AND all
    // integrations finished loading), rebuild cameras and the view from
    // scratch: the available entities may have changed while it was down.
    if (!!this._hass && !wasReady && isReady) {
      // Tear cameras down before the listeners below see the new hass,
      // otherwise they would briefly rebuild against the old entities.
      log(
        this._api.getConfigManager().getCardWideConfig(),
        'Advanced Camera Card: HA fully ready, reinitializing...',
      );

      // The entities may differ from those the cameras and the view were
      // initialized against, so both are initialized again.
      const initializationManager = this._api.getInitializationManager();
      initializationManager.invalidateAspect(InitializationAspect.CAMERAS);
      initializationManager.invalidateAspect(InitializationAspect.VIEW);
      initializationManager.invalidateAspect(InitializationAspect.INITIAL_TRIGGER);

      void this._api.getCameraManager().destroy();
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
