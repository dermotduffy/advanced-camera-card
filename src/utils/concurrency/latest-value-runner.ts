/**
 * Runs an async operation for the latest submitted value, one run at a time.
 *
 * While a run is in flight, only the most recently submitted value is kept;
 * values submitted in between are dropped. The kept value runs when the current
 * run finishes, so the operation always converges on the newest input without
 * running more than once at a time.
 *
 * Each `submit` returns a promise that resolves after the next run completes, so
 * a caller can wait for a run to have happened without tracking which value ran
 * (under load its own value may have been superseded by a newer one).
 *
 * The operation owns its own errors: a run that rejects still counts as done
 * (its waiters resolve and draining continues), so a single bad value cannot
 * strand later ones.
 */
export class LatestValueRunner<T> {
  private _run: (value: T) => Promise<void>;

  private _running = false;

  private _pending: { value: T } | null = null;
  private _waiters: Array<() => void> = [];

  constructor(run: (value: T) => Promise<void>) {
    this._run = run;
  }

  // Submit a value to run. Returns a promise that resolves once the next run
  // has completed.
  public submit(value: T): Promise<void> {
    this._pending = { value };
    const ran = new Promise<void>((resolve) => this._waiters.push(resolve));
    if (!this._running) {
      this._running = true;
      // The drain loop cannot reject (the operation's errors are caught within
      // it); the catch only satisfies the no-floating-promises rule.
      /* v8 ignore next -- @preserve */
      this._drain().catch(() => {});
    }
    return ran;
  }

  // Drop any value still waiting to run.
  public clear(): void {
    this._pending = null;
  }

  private async _drain(): Promise<void> {
    try {
      while (this._pending) {
        const { value } = this._pending;
        this._pending = null;

        try {
          await this._run(value);
        } catch {
          // The operation owns its errors; the runner only guarantees progress.
        }

        // Release everyone waiting on a run; values submitted during the run
        // were queued after this snapshot and wait for the next one.
        const waiters = this._waiters;
        this._waiters = [];
        waiters.forEach((resolve) => resolve());
      }
    } finally {
      this._running = false;
    }
  }
}
