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
});
