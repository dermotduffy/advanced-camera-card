import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConditionStateManager } from '../../src/conditions/state-manager';
import { createHASS, createStateEntity } from '../test-utils';

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

      manager.setState(state);
      expect(listener).toBeCalledTimes(1);

      manager.setState(state);
      expect(listener).toBeCalledTimes(1);

      manager.setState({ ...state });
      expect(listener).toBeCalledTimes(1);

      manager.setState({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity(),
        }),
      });
      expect(listener).toBeCalledTimes(2);

      manager.setState({ fullscreen: true });
      expect(listener).toBeCalledTimes(2);

      manager.setState({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity(),
        }),
      });
      expect(listener).toBeCalledTimes(3);

      manager.setState({ fullscreen: false });
      expect(listener).toBeCalledTimes(4);

      manager.setState({ fullscreen: false });
      expect(listener).toBeCalledTimes(4);

      manager.setState({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'off' }),
        }),
      });
      expect(listener).toBeCalledTimes(5);
    });
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
