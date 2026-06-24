import { afterEach, describe, expect, it, vi } from 'vitest';

import { RetryTimer } from '../../src/utils/retry-timer';

// @vitest-environment jsdom
describe('RetryTimer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should schedule a callback after the current backoff delay', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    const cb = vi.fn();

    timer.schedule(cb);
    vi.advanceTimersByTime(999);
    expect(cb).not.toBeCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('should advance the counter on schedule by default', () => {
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    timer.schedule(() => {});
    expect(timer.getAttempts()).toBe(1);
    timer.schedule(() => {});
    expect(timer.getAttempts()).toBe(2);
  });

  it('should not advance the counter when schedule is called with advance: false', () => {
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    timer.schedule(() => {}, { advance: false });
    expect(timer.getAttempts()).toBe(0);
    timer.schedule(() => {}, { advance: false });
    expect(timer.getAttempts()).toBe(0);
  });

  it('should advance the counter via advance()', () => {
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    timer.advance();
    expect(timer.getAttempts()).toBe(1);
    timer.advance();
    expect(timer.getAttempts()).toBe(2);
  });

  it('should use a longer delay after advance()', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    const cb = vi.fn();

    timer.advance();
    timer.schedule(cb);

    // Counter is 1, delay should be base * 2^1 = 2 seconds.
    vi.advanceTimersByTime(1999);
    expect(cb).not.toBeCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('should cancel a pending callback', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    const cb = vi.fn();

    timer.schedule(cb);
    timer.cancel();
    vi.advanceTimersByTime(10_000);
    expect(cb).not.toBeCalled();
  });

  it('should reset both the timer and the counter', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });
    const cb = vi.fn();

    timer.advance();
    timer.advance();
    timer.schedule(cb, { advance: false });
    expect(timer.getAttempts()).toBe(2);
    expect(timer.isRunning()).toBe(true);

    timer.reset();
    expect(timer.getAttempts()).toBe(0);
    expect(timer.isRunning()).toBe(false);

    vi.advanceTimersByTime(10_000);
    expect(cb).not.toBeCalled();
  });

  it('should report running state', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });

    expect(timer.isRunning()).toBe(false);
    timer.schedule(() => {});
    expect(timer.isRunning()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(timer.isRunning()).toBe(false);
  });

  it('should advance the counter when schedule is called with advance: true', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const timer = new RetryTimer({ baseSeconds: 1, maxSeconds: 60 });

    timer.schedule(() => {}, { advance: true });
    expect(timer.getAttempts()).toBe(1);
    timer.schedule(() => {}, { advance: true });
    expect(timer.getAttempts()).toBe(2);
  });

  it('should produce a fixed delay when configured with base=max and jitter=1', () => {
    // The "static delay" idiom: callers wanting a non-growing delay configure
    // the backoff to flatten out. No special mode in the class.
    vi.useFakeTimers();
    const timer = new RetryTimer({
      baseSeconds: 30,
      maxSeconds: 30,
      jitterMin: 1,
      jitterMax: 1,
    });
    const cb = vi.fn();

    timer.advance();
    timer.advance();
    timer.schedule(cb);
    vi.advanceTimersByTime(29_999);
    expect(cb).not.toBeCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('should accept a plain number as shorthand for a fixed delay', () => {
    vi.useFakeTimers();
    const timer = new RetryTimer(30);
    const cb = vi.fn();

    timer.advance();
    timer.schedule(cb);
    vi.advanceTimersByTime(29_999);
    expect(cb).not.toBeCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toBeCalledTimes(1);
  });

  describe('setOptions', () => {
    it('should apply the new backoff config to the next schedule', () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const timer = new RetryTimer({
        baseSeconds: 1,
        maxSeconds: 60,
        jitterMin: 1,
        jitterMax: 1,
      });
      const cb = vi.fn();

      timer.setOptions({
        baseSeconds: 10,
        maxSeconds: 10,
        jitterMin: 1,
        jitterMax: 1,
      });
      timer.schedule(cb);
      vi.advanceTimersByTime(9_999);
      expect(cb).not.toBeCalled();
      vi.advanceTimersByTime(1);
      expect(cb).toBeCalledTimes(1);
    });

    it('should preserve the attempt counter and any pending callback', () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const timer = new RetryTimer({
        baseSeconds: 1,
        maxSeconds: 60,
        jitterMin: 1,
        jitterMax: 1,
      });
      const cb = vi.fn();

      timer.advance();
      timer.advance();
      timer.schedule(cb, { advance: false });
      expect(timer.getAttempts()).toBe(2);
      expect(timer.isRunning()).toBe(true);

      // Idempotent setOptions doesn't touch counter or pending timer.
      timer.setOptions({
        baseSeconds: 1,
        maxSeconds: 60,
        jitterMin: 1,
        jitterMax: 1,
      });
      expect(timer.getAttempts()).toBe(2);
      expect(timer.isRunning()).toBe(true);
    });
  });
});
