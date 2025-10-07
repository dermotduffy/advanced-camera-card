import { isEqual } from 'lodash-es';
import {
  ConditionState,
  ConditionStateChange,
  ConditionStateListener,
  ConditionStateManagerReadonlyInterface,
} from './types';

/**
 * A class to manage state used in the evaluation of conditions.
 */
export class ConditionStateManager implements ConditionStateManagerReadonlyInterface {
  protected _listeners: ConditionStateListener[] = [];
  protected _state: ConditionState = {};

  public addListener(listener: ConditionStateListener): void {
    this._listeners.push(listener);
  }

  public removeListener(listener?: ConditionStateListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  public getState(): ConditionState {
    return this._state;
  }

  public setState(state: ConditionState): void {
    this._processStateChange(this._calculateTrueChange(state));
  }

  protected _processStateChange(changeState: ConditionState): void {
    if (!Object.keys(changeState).length) {
      return;
    }

    const oldState = this._state;
    this._state = {
      ...oldState,
      ...changeState,
    };
    this._callListeners({ old: oldState, change: changeState, new: this._state });
  }

  protected _calculateTrueChange(change: ConditionState): ConditionState {
    const changeState: ConditionState = {};

    for (const key of Object.keys(change)) {
      if (!isEqual(change[key], this._state[key])) {
        changeState[key] = change[key];
      }
    }

    return changeState;
  }

  protected _callListeners = (stateChange: ConditionStateChange): void => {
    this._listeners.forEach((listener) => listener(stateChange));
  };
}
