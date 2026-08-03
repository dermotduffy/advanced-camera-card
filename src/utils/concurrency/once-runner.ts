export type Work = () => Promise<void>;

/**
 * Runs asynchronous work at most once, and shares it while it is in flight.
 *
 * The first call starts the work. Callers that arrive while it is still running
 * wait on that same run rather than starting their own, so ten concurrent
 * callers make one request instead of ten identical ones. Once the work has
 * succeeded, later calls return immediately without running it again.
 *
 * A failure is *not* remembered: every caller waiting on the failed run sees
 * the rejection, and the next call starts a fresh attempt.
 *
 * Only the first caller's `work` ever runs. Callers that join an in-flight run
 * have their own `work` discarded, so every caller must pass work that is
 * interchangeable with the others'.
 */
export class OnceRunner {
  private _succeeded = false;
  private _inFlight: Promise<void> | null = null;

  public async run(work: Work): Promise<void> {
    if (this._succeeded) {
      return;
    }
    this._inFlight ??= this._runOnce(work);

    const inFlight = this._inFlight;
    try {
      await inFlight;
    } finally {
      // Clear only the run this caller waited on. A caller that joined the same
      // failed run may resume after a later caller has already started a fresh
      // one, which must not be discarded.
      if (this._inFlight === inFlight) {
        this._inFlight = null;
      }
    }
  }

  private async _runOnce(work: Work): Promise<void> {
    await work();
    this._succeeded = true;
  }
}
