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
      this._state[ev.key].state = 'up';
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

  private _processStateChange(): void {
    this._api.getConditionStateManager().setState({ keys: this._state });
  }
}
