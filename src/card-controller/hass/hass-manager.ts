import { STATE_RUNNING, type HassConfig } from 'home-assistant-js-websocket';

import type { HASSListener } from '../../ha/source';
import type { HomeAssistant } from '../../ha/types';
import type { UnsubscribeCallback } from '../../types';
import { log } from '../../utils/debug';
import { InitializationAspect } from '../initialization/initialization-manager';
import type { CardHASSAPI } from '../types';
import { EventWatcher, type EventWatcherSubscriptionInterface } from './event-watcher';
import { StateWatcher, type StateWatcherSubscriptionInterface } from './state-watcher';
import type { HASSManagerReadonlyInterface, HASSReadiness } from './types';

export class HASSManager implements HASSManagerReadonlyInterface {
  private _hass: HomeAssistant | null = null;
  private _api: CardHASSAPI;

  // The Home Assistant frontend restores `connected` the moment the socket
  // returns, but keeps reporting this same configuration until its own
  // `get_config` answers.
  private _disconnectedConfig: HassConfig | null = null;

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

  public getReadiness(): HASSReadiness {
    if (!this._hass?.connected) {
      return 'disconnected';
    }
    return this._isReady(this._hass) ? 'ready' : 'starting';
  }

  public isReady(): boolean {
    return this.getReadiness() === 'ready';
  }

  // The frontend reuses the pre-disconnect `hass.config` after reconnecting, so
  // `STATE_RUNNING` can be stale. `_disconnectedConfig` rejects it until a
  // new config object appears.
  private _isReady(hass: HomeAssistant | null): boolean {
    return (
      !!hass?.connected &&
      hass.config !== this._disconnectedConfig &&
      hass.config?.state === STATE_RUNNING
    );
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

    const wasReady = this._isReady(this._hass);

    if (!hass.connected) {
      this._disconnectedConfig = hass.config;
    } else if (hass.config !== this._disconnectedConfig) {
      this._disconnectedConfig = null;
    }

    const isReady = this._isReady(hass);

    // A card cannot be started without Home Assistant, so losing it ends the
    // card's initialization session. The aspects initialized during that
    // session are left in place until it returns, when they are initialized
    // again against whatever entities it comes back with.
    if (wasReady && !isReady) {
      this._api.getInitializationManager().getSessionManager().end();
    }

    // When HA goes from "not ready" to "ready" (reconnected, fresh
    // `hass.config`, and `STATE_RUNNING`), rebuild cameras and view from
    // scratch: available entities may have changed while it was down.
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
