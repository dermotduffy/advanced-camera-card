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
    expect(handler).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).toHaveBeenCalled();
  });

  it('should fire only once a delay past the browser timer limit has passed', () => {
    const timer = new Timer();
    const handler = vi.fn();
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;
    timer.start(thirtyDaysSeconds, handler);

    vi.advanceTimersByTime(thirtyDaysSeconds * 1000 - 1);
    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(timer.isRunning()).toBeFalsy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not fire when stopped during a delay past the browser timer limit', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.start(30 * 24 * 60 * 60, handler);

    // Passes the first browser timer, so the wait continues on a second one.
    vi.advanceTimersByTime(25 * 24 * 60 * 60 * 1000);
    timer.stop();

    vi.runOnlyPendingTimers();
    expect(timer.isRunning()).toBeFalsy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should not fire when stopped', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.start(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toHaveBeenCalled();

    timer.stop();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should fire repeatedly when started', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.startRepeated(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should not fire repeatedly when stopped', () => {
    const timer = new Timer();
    const handler = vi.fn();
    timer.startRepeated(10, handler);

    expect(timer.isRunning()).toBeTruthy();
    expect(handler).not.toHaveBeenCalled();

    timer.stop();

    vi.runOnlyPendingTimers();

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should fire repeatedly at an interval past the browser timer limit', () => {
    const timer = new Timer();
    const handler = vi.fn();
    const thirtyDaysMS = 30 * 24 * 60 * 60 * 1000;
    timer.startRepeated(thirtyDaysMS / 1000, handler);

    vi.advanceTimersByTime(thirtyDaysMS - 1);
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(thirtyDaysMS);
    expect(timer.isRunning()).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(2);

    timer.stop();
  });

  it('should stop repeating when the handler stops the timer', () => {
    const timer = new Timer();
    const handler = vi.fn(() => timer.stop());
    timer.startRepeated(10, handler);

    vi.advanceTimersByTime(30 * 1000);

    expect(timer.isRunning()).toBeFalsy();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
