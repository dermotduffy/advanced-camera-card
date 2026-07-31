import { isEqual } from 'lodash-es';

import { isFocusWithin } from '../utils/focus';
import type { CardKeyboardStateAPI, KeysState } from './types';

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

    // Must capture, since elements within the card stop pointer events propagating
    // (e.g. the zoom controller during a pan).
    element.addEventListener('pointerdown', this._handlePointerdown, {
      capture: true,
    });
  }

  public uninitialize(): void {
    const element = this._api.getCardElementManager().getElement();
    element.removeEventListener('keydown', this._handleKeydown);
    element.removeEventListener('keyup', this._handleKeyup);
    element.removeEventListener('blur', this._handleBlur);
    element.removeEventListener('pointerdown', this._handlePointerdown, {
      capture: true,
    });

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

  // Keys are only received when the card or something within it has focus, so
  // focus is claimed on interaction. The card itself is focused rather than a
  // child, as a child may be removed by the next render and take focus with it.
  private _handlePointerdown = (): void => {
    const element = this._api.getCardElementManager().getElement();

    // Focus already inside the card is left where it is, as taking it would blur
    // whatever the user is interacting with (e.g. a text field being typed in).
    if (isFocusWithin(element)) {
      return;
    }

    // Taking focus must not scroll the dashboard to bring the card into view.
    element.focus({ preventScroll: true });
  };

  private _handleBlur = (ev: FocusEvent): void => {
    // 'relatedTarget' would be the card element due to event retargeting --
    // focus gained by another element within the card will be reported as to
    // the card itself at this level.
    if (ev.relatedTarget === this._api.getCardElementManager().getElement()) {
      return;
    }

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
