import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { Timer } from '../../src/utils/timer';

// @vitest-environment jsdom
describe('Timer', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should not be running on construct', () => {
    const timer = new Timer();
    expect(timer.isRunning()).toBeFalsy();
  });

  it('should fire when started', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.start(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toBeCalled();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).toBeCalled();
  });

  it('should not fire when stopped', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.start(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toBeCalled();

    timer.stop();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).not.toBeCalled();
  });

  it('should fire repeatedly when started', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.startRepeated(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toBeCalled();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).toBeCalledTimes(1);

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).toBeCalledTimes(2);
  });

  it('should not fire repeatedly when stopped', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.startRepeated(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toBeCalled();

    timer.stop();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).not.toBeCalled();
  });
});
