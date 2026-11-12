import { describe, expect, it, vi, type MockInstance } from 'vitest';

import type { CardController } from '../../src/card-controller/controller';
import { KeyboardStateManager } from '../../src/card-controller/keyboard-state-manager';
import type { Trigger } from '../../src/config/schema/condition-trigger/triggers/types';
import { createCardAPI, createLitElement } from '../test-utils';

// @vitest-environment jsdom
describe('KeyboardStateManager', () => {
  const createManager = (
    triggers: Trigger[] = [],
  ): { api: CardController; element: HTMLElement; manager: KeyboardStateManager } => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getAutomationsManager().getTriggers).mockReturnValue(triggers);

    const manager = new KeyboardStateManager(api);
    manager.initialize();

    return { api, element, manager };
  };

  // For the tests that assert whether a press was claimed. Counting the calls
  // on the returned spy, rather than reading `defaultPrevented`, is what tells
  // the manager's prevention apart from that of another listener on the same
  // press.
  const dispatchKeydownWithPreventionSpy = (
    target: HTMLElement,
    options?: KeyboardEventInit,
  ): MockInstance => {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      composed: true,
      cancelable: true,
      ...options,
    });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    target.dispatchEvent(event);

    return preventDefault;
  };

  it('should construct', () => {
    expect(new KeyboardStateManager(createCardAPI())).toBeTruthy();
  });

  it('should set state on keydown', () => {
    const { api, element } = createManager();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(api.getConditionStateManager().setState).toHaveBeenCalledWith({
      keys: {
        a: { state: 'down', ctrl: false, alt: false, meta: false, shift: false },
      },
    });

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    // Duplicate keydown should not re-set the state.
    expect(api.getConditionStateManager().setState).toHaveBeenCalledTimes(1);
  });

  describe('should stop the browser acting on a keypress', () => {
    it('should stop when a trigger acts on the press of the key', () => {
      const { element } = createManager([{ trigger: 'key', key: 'ArrowDown' }]);

      expect(dispatchKeydownWithPreventionSpy(element)).toHaveBeenCalled();
    });

    it('should stop when a trigger acts on the release of the key', () => {
      const { element } = createManager([
        { trigger: 'key', key: 'ArrowDown', state: 'up' },
      ]);

      // The browser scrolls as the key goes down, so the press must be claimed
      // then even though the card acts on the release.
      expect(dispatchKeydownWithPreventionSpy(element)).toHaveBeenCalled();
    });

    it('should not stop when no trigger matches the key', () => {
      const { element } = createManager([{ trigger: 'key', key: 'ArrowUp' }]);

      expect(dispatchKeydownWithPreventionSpy(element)).not.toHaveBeenCalled();
    });

    it('should not stop when the triggers are not about keys at all', () => {
      const { element } = createManager([{ trigger: 'fullscreen', fullscreen: true }]);

      expect(dispatchKeydownWithPreventionSpy(element)).not.toHaveBeenCalled();
    });

    describe('should not stop when a modifier the trigger asks for is absent', () => {
      it.each([
        ['ctrl' as const, { ctrlKey: true }],
        ['alt' as const, { altKey: true }],
        ['meta' as const, { metaKey: true }],
        ['shift' as const, { shiftKey: true }],
      ])('with %s', (modifier: string, held: KeyboardEventInit) => {
        const { element } = createManager([
          { trigger: 'key', key: 'ArrowDown', [modifier]: true },
        ]);

        expect(dispatchKeydownWithPreventionSpy(element)).not.toHaveBeenCalled();
        expect(dispatchKeydownWithPreventionSpy(element, held)).toHaveBeenCalled();
      });
    });

    it('should not stop when a trigger for the key is turned off', () => {
      const { element } = createManager([
        { trigger: 'key', key: 'ArrowDown', enabled: false },
      ]);

      expect(dispatchKeydownWithPreventionSpy(element)).not.toHaveBeenCalled();
    });

    it('should not stop when a trigger watches every key', () => {
      const { api, element } = createManager([{ trigger: 'key' }]);

      expect(dispatchKeydownWithPreventionSpy(element)).not.toHaveBeenCalled();
      expect(api.getConditionStateManager().setState).toHaveBeenCalled();
    });

    it('should stop on every repeat of a held key', () => {
      const { api, element } = createManager([{ trigger: 'key', key: 'ArrowDown' }]);

      expect(dispatchKeydownWithPreventionSpy(element)).toHaveBeenCalled();
      expect(dispatchKeydownWithPreventionSpy(element)).toHaveBeenCalled();

      expect(api.getConditionStateManager().setState).toHaveBeenCalledTimes(1);
    });
  });

  describe('should ignore a key press that belongs to another element', () => {
    it('should ignore when something else has already answered the press', () => {
      const { api, element } = createManager([{ trigger: 'key', key: 'ArrowDown' }]);
      element.addEventListener('keydown', (ev) => ev.preventDefault(), {
        capture: true,
      });

      // Once from the listener above.
      expect(dispatchKeydownWithPreventionSpy(element)).toHaveBeenCalledTimes(1);
      expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
    });

    it('should ignore when a composition is being typed', () => {
      const { api, element } = createManager([{ trigger: 'key', key: 'ArrowDown' }]);

      expect(
        dispatchKeydownWithPreventionSpy(element, { isComposing: true }),
      ).not.toHaveBeenCalled();
      expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
    });

    it('should ignore when the press lands on an element with keys of its own', () => {
      const { api, element } = createManager([{ trigger: 'key', key: 'ArrowDown' }]);
      const input = document.createElement('input');
      element.append(input);

      expect(dispatchKeydownWithPreventionSpy(input)).not.toHaveBeenCalled();
      expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
    });
  });

  it('should set state on keyup', () => {
    const { api, element } = createManager();

    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    // Key not held down in the first place should not update the state.
    expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    expect(api.getConditionStateManager().setState).toHaveBeenCalledTimes(2);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      keys: {
        a: { state: 'up', ctrl: false, alt: false, meta: false, shift: false },
      },
    });
  });

  it('should release held keys on focus loss', () => {
    const { api, element } = createManager();

    element.dispatchEvent(new FocusEvent('blur'));
    expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new FocusEvent('blur'));

    expect(api.getConditionStateManager().setState).toHaveBeenCalledTimes(2);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      keys: {
        a: { state: 'up', ctrl: false, alt: false, meta: false, shift: false },
      },
    });
  });

  it('should set state on keydown of a previously released key', () => {
    const { api, element } = createManager();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new FocusEvent('blur'));
    vi.mocked(api.getConditionStateManager().setState).mockClear();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(api.getConditionStateManager().setState).toHaveBeenCalledWith({
      keys: {
        a: { state: 'down', ctrl: false, alt: false, meta: false, shift: false },
      },
    });
  });

  it('should not set state on focus loss when no key is held', () => {
    const { api, element } = createManager();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    vi.mocked(api.getConditionStateManager().setState).mockClear();

    element.dispatchEvent(new FocusEvent('blur'));

    expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
  });

  it('should not clear state when focus moves within the card', () => {
    const { api, element } = createManager();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new FocusEvent('blur', { relatedTarget: element }));

    expect(api.getConditionStateManager().setState).toHaveBeenCalledTimes(1);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      keys: {
        a: { state: 'down', ctrl: false, alt: false, meta: false, shift: false },
      },
    });
  });

  it('should take focus on pointerdown without a visible focus ring', () => {
    const { element } = createManager();
    const focus = vi.spyOn(element, 'focus');

    element.dispatchEvent(new Event('pointerdown'));

    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });
  });

  it('should not take focus on pointerdown when focus is already within the card', () => {
    const { element } = createManager();
    document.body.append(element);

    const child = document.createElement('div');
    child.setAttribute('tabindex', '0');
    element.attachShadow({ mode: 'open' }).appendChild(child);
    child.focus();

    const focus = vi.spyOn(element, 'focus');

    element.dispatchEvent(new Event('pointerdown'));

    expect(focus).not.toHaveBeenCalled();

    element.remove();
  });

  it('should not take focus on pointerdown after uninitialization', () => {
    const { element, manager } = createManager();
    const focus = vi.spyOn(element, 'focus');
    manager.uninitialize();

    element.dispatchEvent(new Event('pointerdown'));

    expect(focus).not.toHaveBeenCalled();
  });

  it('should not act after uninitialization', () => {
    const { api, element, manager } = createManager();
    manager.uninitialize();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
  });

  it('should release held keys on uninitialize', () => {
    const { api, element, manager } = createManager();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    vi.mocked(api.getConditionStateManager().setState).mockClear();

    manager.uninitialize();

    expect(api.getConditionStateManager().setState).toHaveBeenCalledWith({
      keys: {
        a: { state: 'up', ctrl: false, alt: false, meta: false, shift: false },
      },
    });
  });

  it('should not set state on uninitialize when no keys held', () => {
    const { api, manager } = createManager();
    manager.uninitialize();

    expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
  });
});
