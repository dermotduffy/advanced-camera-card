import { ReactiveControllerHost } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CachedValueController } from '../../src/components-lib/cached-value-controller';

// @vitest-environment jsdom
describe('CachedValueController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should construct', () => {
    const host = mock<ReactiveControllerHost>();
    const callback = vi.fn();
    const controller = new CachedValueController(host, 10, callback);

    expect(controller).toBeTruthy();
  });

  it('should remove host', () => {
    const host = mock<ReactiveControllerHost>();
    const callback = vi.fn();
    const controller = new CachedValueController(host, 10, callback);

    controller.removeController();
    expect(host.removeController).toBeCalled();
  });

  it('should have timer', () => {
    const host = mock<ReactiveControllerHost>();
    const callback = vi.fn();
    const startCallback = vi.fn();
    const stopCallback = vi.fn();

    vi.useFakeTimers();

    const controller = new CachedValueController(
      host,
      10,
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
    expect(controller.value).toBe(3);

    callback.mockReturnValue(4);
    vi.runOnlyPendingTimers();
    expect(callback).toBeCalled();
    expect(host.requestUpdate).toBeCalled();
    expect(controller.value).toBe(4);

    expect(controller.hasTimer()).toBeTruthy();

    controller.stopTimer();
    expect(stopCallback).toBeCalled();

    callback.mockReset();
    vi.runOnlyPendingTimers();
    expect(callback).not.toBeCalled();
  });

  it('should clear value', () => {
    const host = mock<ReactiveControllerHost>();
    const callback = vi.fn().mockReturnValue(42);

    vi.useFakeTimers();

    const controller = new CachedValueController(host, 10, callback);
    controller.startTimer();

    vi.runOnlyPendingTimers();
    expect(controller.value).equal(42);

    controller.clearValue();
    expect(controller.value).toBeUndefined();
  });

  it('should connect and disconnect host', () => {
    const host = mock<ReactiveControllerHost>();
    const callback = vi.fn().mockReturnValue(43);
    const startCallback = vi.fn();
    const stopCallback = vi.fn();

    const controller = new CachedValueController(
      host,
      10,
      callback,
      startCallback,
      stopCallback,
    );

    controller.hostConnected();
    expect(controller.value).equal(43);
    expect(startCallback).toBeCalled();
    expect(host.requestUpdate).toBeCalled();

    controller.hostDisconnected();
    expect(controller.value).toBeUndefined();
    expect(stopCallback).toBeCalled();
  });
});
