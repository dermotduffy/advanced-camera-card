import { CardKeyboardStateAPI, KeysState } from './types';
import { isEqual } from 'lodash-es';

export class KeyboardStateManager {
  private _api: CardKeyboardStateAPI;
  private _state: KeysState = {};

  constructor(api: CardKeyboardStateAPI) {
    this._api = api;
  }

  public initialize(): void {
    const element = this._api.getCardElementManager().getElement();
    element.addEventListener('keydown', this._handleKeydown);
    element.addEventListener('keyup', this._handleKeyup);
    element.addEventListener('blur', this._handleBlur);
  }

  public uninitialize(): void {
    const element = this._api.getCardElementManager().getElement();
    element.removeEventListener('keydown', this._handleKeydown);
    element.removeEventListener('keyup', this._handleKeyup);
    element.removeEventListener('blur', this._handleBlur);

    // Clear state on disconnect. Without listeners the card cannot know
    // whether a key was released while detached, and stale "down" state
    // would suppress the next real keydown (e.g. PTZ stop shortcuts).
    if (Object.keys(this._state).length) {
      this._state = {};
      this._processStateChange();
    }
  }

  private _handleKeydown = (ev: KeyboardEvent): void => {
    const keyObj = {
      state: 'down' as const,
      ctrl: ev.ctrlKey,
      alt: ev.altKey,
      meta: ev.metaKey,
      shift: ev.shiftKey,
    };

    if (!isEqual(this._state[ev.key], keyObj)) {
      this._state[ev.key] = keyObj;
      this._processStateChange();
    }
  };

  private _handleKeyup = (ev: KeyboardEvent): void => {
    if (ev.key in this._state && this._state[ev.key].state === 'down') {
      this._state[ev.key] = { ...this._state[ev.key], state: 'up' as const };
      this._processStateChange();
    }
  };

  private _handleBlur = (): void => {
    if (Object.keys(this._state).length) {
      // State is emptied if the element loses focus.
      this._state = {};
      this._processStateChange();
    }
  };

  // Clone before passing to ConditionStateManager so that subsequent
  // in-place mutations to this._state don't affect the stored reference,
  // which would make isEqual comparisons always see the same object.
  private _processStateChange(): void {
    this._api.getConditionStateManager().setState({ keys: { ...this._state } });
  }
}
