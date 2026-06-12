import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import {
  ConditionState,
  ConditionStateChange,
} from '../../../src/condition-trigger/conditions/types';
import { createHASS, createStateEntity } from '../../test-utils';

describe('ConditionStateManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get state', () => {
    const state = { fullscreen: true };

    const manager = new ConditionStateManager();
    manager.setState(state);
    expect(manager.getState()).toEqual(state);
  });

  describe('should set state', () => {
    it('should set and be able to get it again', () => {
      const state = {
        fullscreen: true,
      };

      const manager = new ConditionStateManager();

      manager.setState(state);
      expect(manager.getState()).toEqual(state);
    });

    it('should set but only trigger when necessary', () => {
      const listener = vi.fn();
      const manager = new ConditionStateManager();
      manager.addListener(listener);

      const state = {
        fullscreen: true,
      };

      expect(manager.setState(state)).toBe(true);
      expect(listener).toBeCalledTimes(1);

      expect(manager.setState(state)).toBe(false);
      expect(listener).toBeCalledTimes(1);

      expect(manager.setState({ ...state })).toBe(false);
      expect(listener).toBeCalledTimes(1);

      expect(
        manager.setState({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity(),
          }),
        }),
      ).toBe(true);
      expect(listener).toBeCalledTimes(2);

      expect(manager.setState({ fullscreen: true })).toBe(false);
      expect(listener).toBeCalledTimes(2);

      expect(
        manager.setState({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity(),
          }),
        }),
      ).toBe(true);
      expect(listener).toBeCalledTimes(3);

      expect(manager.setState({ fullscreen: false })).toBe(true);
      expect(listener).toBeCalledTimes(4);

      expect(manager.setState({ fullscreen: false })).toBe(false);
      expect(listener).toBeCalledTimes(4);

      expect(
        manager.setState({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({ state: 'off' }),
          }),
        }),
      ).toBe(true);
      expect(listener).toBeCalledTimes(5);
    });
  });

  it('should serialize a state change made from within a listener', () => {
    const manager = new ConditionStateManager();
    const seen: ConditionStateChange[] = [];
    let reentrantReturn: boolean | null | undefined = undefined;
    let stateDuringDispatch: ConditionState | undefined;

    manager.addListener((change) => {
      seen.push(change);

      // Reentrantly flip the value the originating change just set, capturing
      // what is observable mid-dispatch so it can be asserted outside the
      // callback (where a failure cannot be swallowed).
      if (!reentrantReturn === undefined) {
        reentrantReturn = manager.setState({ fullscreen: false });
        stateDuringDispatch = manager.getState();
      }
    });

    expect(manager.setState({ fullscreen: true })).toBe(true);

    // The reentrant change is deferred: it returns null and, crucially, is NOT
    // applied while the originating dispatch is still in flight -- fullscreen is
    // still true despite the reentrant call to set it false.
    expect(reentrantReturn).toBeNull();
    expect(stateDuringDispatch).toEqual({ fullscreen: true });

    // It is dispatched only after the originating change, seeing that change's
    // result as its own `old`: a coherent edge, not a torn state. Only now does
    // fullscreen become false.
    expect(seen).toEqual([
      { old: {}, change: { fullscreen: true }, new: { fullscreen: true } },
      {
        old: { fullscreen: true },
        change: { fullscreen: false },
        new: { fullscreen: false },
      },
    ]);
    expect(manager.getState()).toEqual({ fullscreen: false });
  });

  it('should add listener', () => {
    const listener = vi.fn();
    const manager = new ConditionStateManager();

    manager.setState({ fullscreen: true });

    manager.addListener(listener);

    manager.setState({ expand: true });

    expect(listener).toBeCalledWith({
      old: { fullscreen: true },
      change: { expand: true },
      new: { fullscreen: true, expand: true },
    });
  });

  it('should remove listener', () => {
    const listener = vi.fn();
    const manager = new ConditionStateManager();

    manager.addListener(listener);
    manager.removeListener(listener);

    const state = { fullscreen: true };
    manager.setState(state);

    expect(listener).not.toBeCalled();
  });
});
