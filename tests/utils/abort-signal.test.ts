import { describe, expect, it, vi } from 'vitest';
import { onAbort } from '../../src/utils/abort-signal';

describe('onAbort', () => {
  it('should call the callback when the signal aborts', () => {
    const ac = new AbortController();
    const cb = vi.fn();
    onAbort(ac.signal, cb);

    expect(cb).not.toBeCalled();

    ac.abort();
    expect(cb).toBeCalledTimes(1);
  });

  it('should call the callback synchronously if the signal is already aborted', () => {
    const ac = new AbortController();
    ac.abort();

    const cb = vi.fn();
    onAbort(ac.signal, cb);

    expect(cb).toBeCalledTimes(1);
  });

  it('should fire only once even if the signal aborts repeatedly', () => {
    const ac = new AbortController();
    const cb = vi.fn();
    onAbort(ac.signal, cb);

    ac.abort();
    // Aborting an AbortController again is a no-op, but verify the listener
    // is registered with `once: true` so any synthetic re-fire would be a
    // no-op too.
    ac.signal.dispatchEvent(new Event('abort'));

    expect(cb).toBeCalledTimes(1);
  });
});
