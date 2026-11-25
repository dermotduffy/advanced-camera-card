// Browsers store a `setTimeout` delay as a signed 32-bit number of milliseconds
// (about 24.8 days), so a longer delay wraps around and fires early, usually
// immediately. `Timer` waits out a longer delay over several timeouts of at
// most this length:
// https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#maximum_delay_value
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export class Timer {
  private _timer: number | null = null;

  public stop(): void {
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = null;
    }
  }

  public isRunning(): boolean {
    return this._timer !== null;
  }

  public start(seconds: number, func: () => void): void {
    this.stop();
    this._startTimeout(seconds * 1000, () => {
      this._timer = null;
      func();
    });
  }

  // Repeats with a fresh timeout per interval rather than `setInterval`, which
  // shares the delay limit and would repeat a longer interval every few
  // milliseconds.
  public startRepeated(seconds: number, func: () => void): void {
    this.stop();
    const repeat = (): void => {
      this._startTimeout(seconds * 1000, () => {
        // The next interval starts before `func` runs, so `func` can stop the
        // timer.
        repeat();
        func();
      });
    };
    repeat();
  }

  // Waits `ms` in chunks of at most `MAX_TIMEOUT_MS` (the browser delay limit),
  // so a longer delay still fires on time rather than early.
  private _startTimeout(ms: number, func: () => void): void {
    // This class is the sanctioned wrapper for the browser timer APIs.
    // eslint-disable-next-line no-restricted-syntax
    this._timer = window.setTimeout(
      () => {
        if (ms > MAX_TIMEOUT_MS) {
          this._startTimeout(ms - MAX_TIMEOUT_MS, func);
          return;
        }
        func();
      },
      Math.min(ms, MAX_TIMEOUT_MS),
    );
  }
}
