/**
 * Register a cleanup callback to fire when an `AbortSignal` aborts. Unlike
 * `signal.addEventListener('abort', cb)` directly, this fires the callback
 * immediately if the signal is already aborted.
 */
export const onAbort = (signal: AbortSignal, callback: () => void): void => {
  if (signal.aborted) {
    callback();
  } else {
    signal.addEventListener('abort', callback, { once: true });
  }
};
