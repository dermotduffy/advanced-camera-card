import { describe, expect, it, vi } from 'vitest';

import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { createHASS, createHASSSource, createStateEntity } from '../../test-utils';

describe('StateWatcher', () => {
  it('should not subscribe with no entities', () => {
    const { source } = createHASSSource();
    const stateWatcher = new StateWatcher(source);
    expect(stateWatcher.subscribe(vi.fn(), [])).toBeFalsy();
  });

  it('should attach to the source lazily on first subscriber', () => {
    const { source, getListenerCount } = createHASSSource(createHASS());
    const stateWatcher = new StateWatcher(source);
    expect(getListenerCount()).toBe(0);
    stateWatcher.subscribe(vi.fn(), ['binary_sensor.foo']);
    expect(getListenerCount()).toBe(1);
  });

  it('should stay attached while other subscribers remain', () => {
    const { source, getListenerCount } = createHASSSource(createHASS());
    const stateWatcher = new StateWatcher(source);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    stateWatcher.subscribe(cb1, ['binary_sensor.foo']);
    stateWatcher.subscribe(cb2, ['binary_sensor.bar']);
    expect(getListenerCount()).toBe(1);

    stateWatcher.unsubscribe(cb1);
    expect(getListenerCount()).toBe(1);
  });

  it('should detach from the source when the last subscriber leaves', () => {
    const { source, getListenerCount } = createHASSSource(createHASS());
    const stateWatcher = new StateWatcher(source);
    const callback = vi.fn();

    stateWatcher.subscribe(callback, ['binary_sensor.foo']);
    expect(getListenerCount()).toBe(1);

    stateWatcher.unsubscribe(callback);
    expect(getListenerCount()).toBe(0);
  });

  it('should call back with state change', () => {
    const initial = createHASS({
      'binary_sensor.foo': createStateEntity({ state: 'on' }),
      'binary_sensor.bar': createStateEntity({ state: 'off' }),
    });
    const { source, push } = createHASSSource(initial);
    const stateWatcher = new StateWatcher(source);
    const callback = vi.fn();

    expect(stateWatcher.subscribe(callback, ['binary_sensor.foo'])).toBeTruthy();
    expect(stateWatcher.subscribe(callback, ['binary_sensor.bar'])).toBeTruthy();

    push(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
        'binary_sensor.bar': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(
      expect.objectContaining({
        entityID: 'binary_sensor.bar',
        oldState: createStateEntity({ state: 'off' }),
        newState: createStateEntity({ state: 'on' }),
      }),
    );
  });

  it('should not call back when oldHass is null on first observed push', () => {
    const { source, push } = createHASSSource(null);
    const stateWatcher = new StateWatcher(source);
    const callback = vi.fn();

    stateWatcher.subscribe(callback, ['binary_sensor.foo']);

    push(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).not.toBeCalled();
  });

  it('should not call back without state change', () => {
    const initial = createHASS({
      'binary_sensor.foo': createStateEntity({ state: 'on' }),
    });
    const { source, push } = createHASSSource(initial);
    const stateWatcher = new StateWatcher(source);
    const callback = vi.fn();

    expect(stateWatcher.subscribe(callback, ['binary_sensor.foo'])).toBeTruthy();

    push(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).not.toBeCalled();
  });

  it('should not call back when unsubscribed', () => {
    const initial = createHASS({
      'binary_sensor.foo': createStateEntity({ state: 'on' }),
    });
    const { source, push } = createHASSSource(initial);
    const stateWatcher = new StateWatcher(source);
    const callback = vi.fn();

    expect(stateWatcher.subscribe(callback, ['binary_sensor.foo'])).toBeTruthy();
    stateWatcher.unsubscribe(callback);

    push(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'off' }),
      }),
    );

    expect(callback).not.toBeCalled();
  });
});
