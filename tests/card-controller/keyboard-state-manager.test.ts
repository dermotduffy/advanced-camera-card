import { describe, expect, it, vi } from 'vitest';
import { KeyboardStateManager } from '../../src/card-controller/keyboard-state-manager';
import { createCardAPI, createLitElement } from '../test-utils';

// @vitest-environment jsdom
describe('KeyboardStateManager', () => {
  it('should construct', () => {
    expect(new KeyboardStateManager(createCardAPI())).toBeTruthy();
  });

  it('should set state on keydown', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new KeyboardStateManager(api);
    manager.initialize();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(api.getConditionStateManager().setState).toHaveBeenCalledWith({
      keys: {
        a: { state: 'down', ctrl: false, alt: false, meta: false, shift: false },
      },
    });

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    // Duplicate keydown should not re-set the state.
    expect(api.getConditionStateManager().setState).toBeCalledTimes(1);
  });

  it('should set state on keyup', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new KeyboardStateManager(api);
    manager.initialize();

    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    // Key not held down in the first place should not update the state.
    expect(api.getConditionStateManager().setState).not.toBeCalled();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    expect(api.getConditionStateManager().setState).toBeCalledTimes(2);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      keys: {
        a: { state: 'up', ctrl: false, alt: false, meta: false, shift: false },
      },
    });
  });

  it('should set state on focus loss', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new KeyboardStateManager(api);
    manager.initialize();

    element.dispatchEvent(new FocusEvent('blur'));
    expect(api.getConditionStateManager().setState).not.toBeCalled();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    element.dispatchEvent(new FocusEvent('blur'));

    expect(api.getConditionStateManager().setState).toBeCalledTimes(2);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      keys: {},
    });
  });

  it('should not act after uninitialization', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new KeyboardStateManager(api);
    manager.initialize();
    manager.uninitialize();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(api.getConditionStateManager().setState).not.toBeCalled();
  });

  it('should clear held keys on uninitialize', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new KeyboardStateManager(api);
    manager.initialize();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    vi.mocked(api.getConditionStateManager().setState).mockClear();

    manager.uninitialize();

    expect(api.getConditionStateManager().setState).toBeCalledWith({ keys: {} });
  });

  it('should not set state on uninitialize when no keys held', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new KeyboardStateManager(api);
    manager.initialize();
    manager.uninitialize();

    expect(api.getConditionStateManager().setState).not.toBeCalled();
  });
});
