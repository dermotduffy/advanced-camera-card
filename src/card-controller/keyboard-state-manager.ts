import { isEqual } from 'lodash-es';

import { KeyConditionEvaluator } from '../condition-trigger/conditions/conditions/key';
import type { Trigger } from '../config/schema/condition-trigger/triggers/types';
import { isFocusWithin } from '../utils/focus';
import type { CardKeyboardStateAPI, KeysState } from './types';

const KEY_STATES = ['down', 'up'] as const;

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

    this._releaseHeldKeys();
  }

  private _handleKeydown = (ev: KeyboardEvent): void => {
    if (this._isKeyEventOwnedElsewhere(ev)) {
      return;
    }

    // If the card acts on this key, the browser must NOT act on it also (e.g.
    // 'down' should pan the camera without also scrolling the dashboard).
    if (this._isKeyEventClaimedByAnyTrigger(ev)) {
      ev.preventDefault();
    }

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

  private _isKeyEventOwnedElsewhere(ev: KeyboardEvent): boolean {
    // A key press belongs to something other than the card when:
    return (
      // ... something within the card has already answered it ...
      ev.defaultPrevented ||
      // ... a character is mid-composition, e.g. choosing a Japanese character
      // from an input method's candidate list with the arrows ...
      ev.isComposing ||
      // ... or it landed on an element with keys of its own.
      this._isKeyHandlingElement(ev)
    );
  }

  private _isKeyEventClaimedByAnyTrigger(ev: KeyboardEvent): boolean {
    return this._api
      .getAutomationsManager()
      .getTriggers()
      .some((trigger) => this._isKeyEventClaimedByTrigger(ev, trigger));
  }

  private _isKeyHandlingElement(ev: KeyboardEvent): boolean {
    const target = ev.composedPath()[0];

    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  private _isKeyEventClaimedByTrigger(ev: KeyboardEvent, trigger: Trigger): boolean {
    // A trigger with no key of its own (i.e. undefined `trigger.key` field)
    // watches *every* key without "claiming" any, as the card would otherwise
    // swallow every press.
    if (trigger.trigger !== 'key' || trigger.enabled === false) {
      return false;
    }
    const evaluator = new KeyConditionEvaluator(trigger);

    // Must count both directions, since the browser acts on a key as it goes
    // down and so a trigger that acts on the way up must claim it then too.
    return KEY_STATES.some(
      (state) =>
        evaluator.evaluate({
          keys: {
            [ev.key]: {
              state: state,
              ctrl: ev.ctrlKey,
              alt: ev.altKey,
              meta: ev.metaKey,
              shift: ev.shiftKey,
            },
          },
        }).result,
    );
  }

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

    this._releaseHeldKeys();
  };

  // Report every held key as newly released. The card receives key events only
  // while it has focus, so it may never see the key release itself without
  // this, and a condition that matches a released key would thus never
  // evaluate.
  private _releaseHeldKeys(): void {
    let released = false;

    for (const [key, keyObj] of Object.entries(this._state)) {
      if (keyObj.state === 'down') {
        this._state[key] = { ...keyObj, state: 'up' as const };
        released = true;
      }
    }

    if (released) {
      this._processStateChange();
    }
  }

  // Clone before passing to ConditionStateManager so that subsequent
  // in-place mutations to this._state don't affect the stored reference,
  // which would make isEqual comparisons always see the same object.
  private _processStateChange(): void {
    this._api.getConditionStateManager().setState({ keys: { ...this._state } });
  }
}
