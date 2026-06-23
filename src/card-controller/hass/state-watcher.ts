import { getHassDifferences } from '../../ha/get-hass-differences';
import { HASSSource, HASSUnlistenCallback } from '../../ha/source';
import { HassStateDifference, HomeAssistant } from '../../ha/types';

type StateWatcherCallback = (difference: HassStateDifference) => void;

export interface StateWatcherSubscriptionInterface {
  subscribe(callback: StateWatcherCallback, entityIDs: string[]): boolean;
  unsubscribe(callback: StateWatcherCallback): void;
}

export class StateWatcher implements StateWatcherSubscriptionInterface {
  private _source: HASSSource;
  private _watcherCallbacks = new Map<StateWatcherCallback, string[]>();
  private _unlisten: HASSUnlistenCallback | null = null;

  constructor(source: HASSSource) {
    this._source = source;
  }

  public subscribe(callback: StateWatcherCallback, entityIDs: string[]): boolean {
    if (!entityIDs.length) {
      return false;
    }
    const wasEmpty = this._watcherCallbacks.size === 0;
    if (this._watcherCallbacks.has(callback)) {
      this._watcherCallbacks.get(callback)?.push(...entityIDs);
    } else {
      this._watcherCallbacks.set(callback, entityIDs);
    }
    if (wasEmpty) {
      this._unlisten = this._source.addListener((hass, oldHass) =>
        this._onHASS(hass, oldHass),
      );
    }
    return true;
  }

  public unsubscribe(callback: StateWatcherCallback): void {
    this._watcherCallbacks.delete(callback);
    if (this._watcherCallbacks.size === 0 && this._unlisten) {
      this._unlisten();
      this._unlisten = null;
    }
  }

  private _onHASS(hass: HomeAssistant, oldHass: HomeAssistant | null): void {
    if (!oldHass) {
      return;
    }
    for (const [callback, entityIDs] of this._watcherCallbacks.entries()) {
      const differences = getHassDifferences(hass, oldHass, entityIDs, {
        stateOnly: true,
        firstOnly: true,
      });
      if (differences.length) {
        callback(differences[0]);
      }
    }
  }
}
