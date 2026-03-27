import { ReactiveControllerHost } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CachedValueController } from '../../src/components-lib/cached-value-controller';

// @vitest-environment jsdom
describe('CachedValueController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not restart timer on hostUpdate if not connected', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue(42);
    let refreshSeconds: number | null = 10;

    const controller = new CachedValueController(host, () => refreshSeconds, callback);

    Object.defineProperty(host, 'isConnected', { get: () => false });

    refreshSeconds = 20;
    controller.hostUpdate();
    expect(controller.hasTimer()).toBeFalsy();
  });

  it('should not restart timer if unchanged on hostUpdate', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue(42);
    const refreshSeconds: number | null = 10;

    const controller = new CachedValueController(host, () => refreshSeconds, callback);

    Object.defineProperty(host, 'isConnected', { get: () => true });

    // This starts the timer as isConnected is true
    controller.hostConnected();

    const startTimerSpy = vi.spyOn(controller, 'startTimer');

    controller.hostUpdate();

    // Should not restart since refreshSeconds hasn't changed
    expect(startTimerSpy).not.toBeCalled();
  });

  it('should construct', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn();
    const controller = new CachedValueController(host, () => 10, callback);

    expect(controller).toBeTruthy();
  });

  it('should have timer', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn();
    const startCallback = vi.fn();
    const stopCallback = vi.fn();

    vi.useFakeTimers();

    const controller = new CachedValueController(
      host,
      () => 10,
      callback,
      startCallback,
      stopCallback,
    );

    controller.startTimer();
    expect(startCallback).toBeCalled();

    callback.mockReturnValue(3);
    vi.runOnlyPendingTimers();
    expect(callback).toBeCalled();
    expect(host.requestUpdate).toBeCalled();
    expect(controller.getValue()).toBe(3);

    callback.mockReturnValue(4);
    vi.runOnlyPendingTimers();
    expect(callback).toBeCalled();
    expect(host.requestUpdate).toBeCalled();
    expect(controller.getValue()).toBe(4);

    expect(controller.hasTimer()).toBeTruthy();

    controller.stopTimer();
    expect(stopCallback).toBeCalled();

    callback.mockReset();
    vi.runOnlyPendingTimers();
    expect(callback).not.toBeCalled();
  });

  it('should clear value', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue(42);

    vi.useFakeTimers();

    const controller = new CachedValueController(host, () => 10, callback);
    controller.startTimer();

    vi.runOnlyPendingTimers();
    expect(controller.getValue()).equal(42);

    controller.clearValue();
    expect(controller.getValue()).toBeNull();
  });

  it('should connect and disconnect host', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue(43);
    const startCallback = vi.fn();
    const stopCallback = vi.fn();

    const controller = new CachedValueController(
      host,
      () => 10,
      callback,
      startCallback,
      stopCallback,
    );

    controller.hostConnected();
    expect(controller.getValue()).equal(43);
    expect(startCallback).toBeCalled();
    expect(host.requestUpdate).toBeCalled();

    controller.hostDisconnected();
    expect(controller.getValue()).toBeNull();
    expect(stopCallback).toBeCalled();
  });

  it('should call timer tick callback on each tick before updateValue', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue('value');
    const tickCallback = vi.fn();

    vi.useFakeTimers();

    const controller = new CachedValueController(
      host,
      () => 5,
      callback,
      undefined,
      undefined,
      tickCallback,
    );

    controller.startTimer();

    vi.runOnlyPendingTimers();
    expect(tickCallback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.runOnlyPendingTimers();
    expect(tickCallback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should not call timerTickCallback on manual updateValue', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue('value');
    const tickCallback = vi.fn();

    const controller = new CachedValueController(
      host,
      () => 5,
      callback,
      undefined,
      undefined,
      tickCallback,
    );

    controller.updateValue();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(tickCallback).not.toHaveBeenCalled();
  });

  it('should restart timer with new interval on hostUpdate', () => {
    const host = mock<ReactiveControllerHost & HTMLElement>();
    const callback = vi.fn().mockReturnValue(42);
    let refreshSeconds: number | null = null;

    const controller = new CachedValueController(host, () => refreshSeconds, callback);

    vi.useFakeTimers();
    Object.defineProperty(host, 'isConnected', { get: () => true });
    controller.hostConnected();
    expect(controller.hasTimer()).toBeFalsy();

    refreshSeconds = 20;
    controller.hostUpdate();

    // Timer should have been restarted. Fast forward 15 seconds. If it didn't
    // restart, it would fire at 10 seconds. Since it restarted at 20 seconds,
    // it shouldn't fire at 15 seconds.
    callback.mockClear();
    vi.advanceTimersByTime(15 * 1000);
    expect(callback).not.toBeCalled();

    vi.advanceTimersByTime(5 * 1000);
    expect(callback).toBeCalled();

    // Now set it to null -> stops timer
    refreshSeconds = null;
    controller.hostUpdate();
    expect(controller.hasTimer()).toBeFalsy();

    // Now set it to 0 -> stops timer
    refreshSeconds = 0;
    controller.hostUpdate();
    expect(controller.hasTimer()).toBeFalsy();

    // Now set it to negative -> stops timer
    refreshSeconds = -1;
    controller.hostUpdate();
    expect(controller.hasTimer()).toBeFalsy();
  });
});
