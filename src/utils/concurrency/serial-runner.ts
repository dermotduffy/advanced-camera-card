type Work<R = unknown> = () => R;

/**
 * Runs work synchronously, but never re-entrantly.
 *
 * If `run` is called again from within an in-flight `run` (for example a
 * listener that reacts to the work by triggering more work), the new work is
 * queued and run after the current work completes, in the order it was
 * enqueued -- never nested inside it. This keeps any state the work mutates
 * coherent for the duration of each run, instead of being altered by a
 * re-entrant change mid-run.
 *
 * The top-level call returns its work's result. A re-entrant (queued) call
 * cannot return its result synchronously -- the work has not run yet -- so it
 * returns `null`; only the top-level result is meaningful.
 */
export class SerialRunner {
  private _queue: Work[] = [];
  private _running = false;

  public run<R>(work: Work<R>): R | null {
    // A re-entrant call is left for the in-flight run loop to drain.
    if (this._running) {
      this._queue.push(work);
      return null;
    }

    this._running = true;
    try {
      const result = work();
      while (this._queue.length) {
        const batch = this._queue;
        this._queue = [];
        for (const queued of batch) {
          queued();
        }
      }
      return result;
    } finally {
      this._running = false;
    }
  }
}
