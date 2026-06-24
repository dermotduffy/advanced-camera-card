import { isEqual } from 'lodash-es';

import { SerialRunner } from '../../utils/concurrency/serial-runner';
import type {
  ConditionState,
  ConditionStateChange,
  ConditionStateListener,
  ConditionStateManagerReadonlyInterface,
} from './types';

/**
 * A class to manage state used in the evaluation of conditions.
 */
export class ConditionStateManager implements ConditionStateManagerReadonlyInterface {
  private _listeners: ConditionStateListener[] = [];
  private _state: ConditionState = {};

  // Serializes application so a change made from within a listener (e.g. an
  // action that updates the card state) is applied after the in-flight change,
  // never nested inside it (which would alter the state mid-dispatch).
  private _runner = new SerialRunner();

  public addListener(listener: ConditionStateListener): void {
    this._listeners.push(listener);
  }

  public removeListener(listener?: ConditionStateListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  public getState(): ConditionState {
    return this._state;
  }

  // Returns whether the state changed, or `null` if the change was deferred
  // (made reentrantly from within a listener) and so its outcome is not yet
  // known.
  public setState(state: ConditionState): boolean | null {
    return this._runner.run(() => this._applyChange(state));
  }

  private _applyChange(state: ConditionState): boolean {
    const changeState = this._calculateTrueChange(state);
    if (!Object.keys(changeState).length) {
      return false;
    }

    const oldState = this._state;
    this._state = {
      ...oldState,
      ...changeState,
    };
    this._callListeners({ old: oldState, change: changeState, new: this._state });
    return true;
  }

  private _calculateTrueChange(change: ConditionState): ConditionState {
    const changeState: ConditionState = {};

    for (const key of Object.keys(change)) {
      if (!isEqual(change[key], this._state[key])) {
        changeState[key] = change[key];
      }
    }

    return changeState;
  }

  private _callListeners = (stateChange: ConditionStateChange): void => {
    this._listeners.forEach((listener) => listener(stateChange));
  };
}
