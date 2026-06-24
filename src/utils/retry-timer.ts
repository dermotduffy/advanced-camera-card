import {
  ExponentialBackoff,
  type ExponentialBackoffOptions,
} from './exponential-backoff';
import { Timer } from './timer';

// Expand a plain `number` (fixed delay in seconds) into the equivalent
// `ExponentialBackoffOptions`: base = max so growth flattens, jitter pinned to
// 1.0 so the delay is exactly N every time.
const convertToBackoffOptions = (
  options: ExponentialBackoffOptions | number,
): ExponentialBackoffOptions => {
  if (typeof options === 'number') {
    return {
      baseSeconds: options,
      maxSeconds: options,
      jitterMin: 1,
      jitterMax: 1,
    };
  }
  return options;
};

/**
 * Pairs an `ExponentialBackoff` with a `Timer` for retry scheduling. Each
 * `schedule(...)` call fires after the current backoff delay; `advance()`
 * bumps the counter for next time.
 *
 * Constructor and `setOptions` accept either `ExponentialBackoffOptions`
 * (growth + jitter) or a plain `number` (fixed delay in seconds, no growth,
 * no jitter). Internally a number expands to `{ baseSeconds: N, maxSeconds:
 * N, jitterMin: 1, jitterMax: 1 }` so all methods behave uniformly -- callers
 * never branch.
 *
 * Typical patterns:
 *  - "Failure happened, retry later, count this failure": `schedule(cb)`.
 *  - "Retry deferred for an unrelated reason; don't compound":
 *    `schedule(cb, { advance: false })` (re-arms at the current delay).
 *  - "Attempt happened, count it separately from scheduling": `advance()`.
 *  - "Operation succeeded": `reset()`.
 *  - "Caller going away": `cancel()`.
 */
export class RetryTimer {
  private readonly _backoff: ExponentialBackoff;
  private readonly _timer = new Timer();

  constructor(options: ExponentialBackoffOptions | number) {
    this._backoff = new ExponentialBackoff(convertToBackoffOptions(options));
  }

  /**
   * Replace the backoff configuration. Cheap and idempotent: doesn't cancel
   * pending callbacks or reset the attempt counter, so it's safe to call on
   * every scheduling pass regardless of whether the options actually changed.
   * Call `reset()` separately if zeroing the counter is desired (e.g. on a
   * semantically distinct mode switch).
   */
  public setOptions(options: ExponentialBackoffOptions | number): void {
    this._backoff.setOptions(convertToBackoffOptions(options));
  }

  /**
   * Schedule `callback` to fire after the current delay, then advance the
   * attempt counter so the next schedule uses a longer delay. Pass
   * `{ advance: false }` to re-arm at the current delay without counting it
   * (e.g. a retry that may be gated and re-scheduled). Any pending callback
   * is canceled before scheduling.
   */
  public schedule(callback: () => void, options?: { advance?: boolean }): void {
    this._timer.start(this._backoff.peek(), callback);
    if (options?.advance !== false) {
      this._backoff.next();
    }
  }

  /**
   * Bump the attempt counter without scheduling. For flows where the schedule
   * call and the "attempt happened, count it" event are separate (e.g. the
   * scheduled callback may or may not actually retry, depending on a gate).
   */
  public advance(): void {
    this._backoff.next();
  }

  public cancel(): void {
    this._timer.stop();
  }

  public reset(): void {
    this._timer.stop();
    this._backoff.reset();
  }

  public isRunning(): boolean {
    return this._timer.isRunning();
  }

  public getAttempts(): number {
    return this._backoff.getAttempts();
  }
}
