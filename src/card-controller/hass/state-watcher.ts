import { HomeAssistant } from '../../ha/types';
import { getHassDifferences, HassStateDifference } from '../../utils/ha';

type StateWatcherCallback = (difference: HassStateDifference) => void;

export interface StateWatcherSubscriptionInterface {
  subscribe(callback: StateWatcherCallback, entityIDs: string[]): void;
  unsubscribe(callback: StateWatcherCallback): void;
}

export class StateWatcher implements StateWatcherSubscriptionInterface {
  protected _watcherCallbacks = new Map<StateWatcherCallback, string[]>();

  public setHASS(oldHass: HomeAssistant | null, hass: HomeAssistant): void {
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

  /**
   * Calls callback when the state of any of the entities changes. The callback is
   * called with the state difference of the first entity that changed.
   * @param callback The callback.
   * @param entityIDs An array of entity IDs to watch.
   */
  public subscribe(callback: StateWatcherCallback, entityIDs: string[]): boolean {
    if (!entityIDs.length) {
      return false;
    }
    if (this._watcherCallbacks.has(callback)) {
      this._watcherCallbacks.get(callback)?.push(...entityIDs);
    } else {
      this._watcherCallbacks.set(callback, entityIDs);
    }
    return true;
  }

  public unsubscribe(callback: StateWatcherCallback): void {
    this._watcherCallbacks.delete(callback);
  }
}
