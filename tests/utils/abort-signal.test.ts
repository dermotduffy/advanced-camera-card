import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAbortSignalWithTimeout, onAbort } from '../../src/utils/abort-signal';

// @vitest-environment jsdom
describe('onAbort', () => {
  it('should call the callback when the signal aborts', () => {
    const ac = new AbortController();
    const cb = vi.fn();
    onAbort(ac.signal, cb);

    expect(cb).not.toHaveBeenCalled();

    ac.abort();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should call the callback synchronously if the signal is already aborted', () => {
    const ac = new AbortController();
    ac.abort();

    const cb = vi.fn();
    onAbort(ac.signal, cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should fire only once even if the signal aborts repeatedly', () => {
    const ac = new AbortController();
    const cb = vi.fn();
    onAbort(ac.signal, cb);

    ac.abort();
    ac.abort();

    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('createAbortSignalWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use native AbortSignal.timeout when available', () => {
    const native = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(native);

    expect(createAbortSignalWithTimeout(10)).toBe(native);
    expect(timeout).toHaveBeenCalledWith(10 * 1000);
  });

  describe('when the browser has no AbortSignal.timeout', () => {
    let original: typeof AbortSignal.timeout;

    beforeEach(() => {
      original = AbortSignal.timeout;

      // @ts-expect-error -- removing a standard static to emulate an older
      // browser (e.g. Chromecast receiver).
      delete AbortSignal.timeout;
    });

    afterEach(() => {
      AbortSignal.timeout = original;
    });

    it('should abort the signal once the seconds elapse', () => {
      const signal = createAbortSignalWithTimeout(10);

      expect(signal.aborted).toBeFalsy();

      vi.advanceTimersByTime(10 * 1000);

      expect(signal.aborted).toBeTruthy();
    });

    it('should abort with a TimeoutError reason', () => {
      const signal = createAbortSignalWithTimeout(10);

      vi.advanceTimersByTime(10 * 1000);

      expect(signal.reason).toBeInstanceOf(DOMException);
      expect(signal.reason.name).toBe('TimeoutError');
    });
  });
});
