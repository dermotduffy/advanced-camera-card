import { Timer } from './timer';

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

/**
 * An `AbortSignal` that aborts itself after a number of seconds, the same as
 * `AbortSignal.timeout()` does.
 *
 * Chrome only gained `AbortSignal.timeout()` in 103, and the card supports back
 * to Chrome 92 for Chromecast receivers, so a timer stands in on older
 * browsers. As in the native version, the timer is just left to run: aborting
 * a request that already finished does nothing so there is nothing to cancel.
 */
export const createAbortSignalWithTimeout = (seconds: number): AbortSignal => {
  if (AbortSignal.timeout) {
    return AbortSignal.timeout(seconds * 1000);
  }

  const controller = new AbortController();
  new Timer().start(seconds, () =>
    // Exactly the same message/exception as the native version.
    controller.abort(new DOMException('signal timed out', 'TimeoutError')),
  );
  return controller.signal;
};
