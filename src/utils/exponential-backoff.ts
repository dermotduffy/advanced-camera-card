// Default jitter range applied to each computed delay: a random multiplier in
// [50%, 100%] of the pre-jitter value, avoiding thundering-herd retries when
// multiple instances back off in lockstep.
const DEFAULT_JITTER_MIN = 0.5;
const DEFAULT_JITTER_MAX = 1.0;

export interface ExponentialBackoffOptions {
  // Delay for the first retry (attempt 1). Subsequent attempts double the delay
  // until `maxSeconds` is reached.
  baseSeconds: number;

  // Upper bound on the delay after exponential growth. The delay never exceeds
  // this regardless of attempt count.
  maxSeconds: number;

  // Random multiplier applied to each computed delay. Defaults to
  // [DEFAULT_JITTER_MIN, DEFAULT_JITTER_MAX].
  jitterMin?: number;
  jitterMax?: number;
}

/**
 * Stateful exponential-backoff delay calculator. Holds an attempt counter,
 * returns the next delay on each `next()` call, and can be `reset()` after a
 * successful operation.
 *
 * Example:
 * ```ts
 * const backoff = new ExponentialBackoff({ baseSeconds: 1, maxSeconds: 300 });
 * // 1st failure -> backoff.next() returns ~1s (jittered).
 * // 2nd failure -> ~2s.
 * // 3rd failure -> ~4s. ... -> 300s ceiling.
 * // After success: backoff.reset().
 * ```
 */
export class ExponentialBackoff {
  private _baseSeconds = 0;
  private _maxSeconds = 0;
  private _jitterMin = DEFAULT_JITTER_MIN;
  private _jitterMax = DEFAULT_JITTER_MAX;
  private _attempts = 0;

  constructor(options: ExponentialBackoffOptions) {
    this.setOptions(options);
  }

  public setOptions(options: ExponentialBackoffOptions): void {
    this._baseSeconds = options.baseSeconds;
    this._maxSeconds = options.maxSeconds;
    this._jitterMin = options.jitterMin ?? DEFAULT_JITTER_MIN;
    this._jitterMax = options.jitterMax ?? DEFAULT_JITTER_MAX;
  }

  /**
   * Returns the next delay in seconds and increments the attempt counter. The
   * pre-jitter delay is `baseSeconds * 2^(attempts before increment)`, capped
   * at `maxSeconds`. Jitter is a random multiplier in [jitterMin, jitterMax].
   */
  public next(): number {
    const delay = this.peek();
    this._attempts += 1;
    return delay;
  }

  /**
   * Returns what the next `next()` call would return WITHOUT incrementing the
   * counter. Useful for "re-arm at the same backoff level" cases (a scheduled
   * retry deferred for an unrelated reason; don't compound the backoff). Note
   * jitter is re-rolled each call, so two consecutive `peek()`s may return
   * slightly different values for the same attempt count.
   */
  public peek(): number {
    const exp = Math.min(this._maxSeconds, this._baseSeconds * 2 ** this._attempts);
    const jitter = this._jitterMin + Math.random() * (this._jitterMax - this._jitterMin);
    return exp * jitter;
  }

  public reset(): void {
    this._attempts = 0;
  }

  public getAttempts(): number {
    return this._attempts;
  }
}
