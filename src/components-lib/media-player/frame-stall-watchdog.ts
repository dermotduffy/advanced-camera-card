import type { LivenessCallback, UnsubscribeCallback } from '../../types';
import { Timer } from '../../utils/timer';

// A playing stream that presents no new frame for this long is treated as
// stalled (a silent freeze). Long enough that a low-frame-rate stream still
// presents a frame within the window.
export const FRAME_STALL_SECONDS = 10;

export interface FrameStallWatchdogConfig {
  // Whether a missing frame right now is a real stall. Returns false while the
  // source is legitimately idle (e.g. paused / seeking / ended), so a paused
  // stream is not reported as frozen.
  shouldReportStall: () => boolean;

  // Begin receiving frames (the caller wires its frame source to
  // `notifyFrame`). Returns false when no source is available -- then the stall
  // timer is never armed, so no stall is ever reported (e.g. video missing
  // `requestVideoFrameCallback`). Defaults to an always-available source.
  startSource?: () => boolean;

  // Stop receiving frames. Defaults to a no-op, for a source that needs no
  // teardown.
  stopSource?: () => void;
}

/**
 * Detects a silent freeze in a frame-based stream: each presented frame kicks a
 * single timer (via `notifyFrame`); if the timer ever fires, no frame arrived
 * within the window and the stream is reported stalled. The next frame reports
 * it live again.
 *
 * Source-agnostic: the caller feeds frames from whatever it has (a video's
 * `requestVideoFrameCallback`, a jsmpeg decode callback, ...) and supplies the
 * `shouldReportStall` predicate. Multiple subscribers share one watchdog,
 * refcounted -- the source starts on the first subscriber and stops on the
 * last.
 */
export class FrameStallWatchdog {
  private _config: FrameStallWatchdogConfig;

  private _timer = new Timer();
  private _callbacks = new Set<LivenessCallback>();

  // `null` means no frame has been observed yet (unconfirmed): a subscriber is
  // told `true` only once a real frame arrives, so merely being subscribed
  // never masquerades as confirmed liveness.
  private _isLive: boolean | null = null;
  private _sourceActive = false;

  constructor(config: FrameStallWatchdogConfig) {
    this._config = config;
  }

  public subscribe(callback: LivenessCallback): UnsubscribeCallback {
    const hadNoSubscribers = this._callbacks.size === 0;
    this._callbacks.add(callback);
    if (hadNoSubscribers) {
      this._start();
    }

    return (): void => {
      this._callbacks.delete(callback);
      if (this._callbacks.size === 0) {
        this._stop();
      }
    };
  }

  // Kick the watchdog: a frame was presented, so the stream is live and the
  // stall timer restarts.
  public notifyFrame(): void {
    if (!this._sourceActive) {
      return;
    }
    this._timer.start(FRAME_STALL_SECONDS, () => this._onStall());

    // Notify last: if this recovery notification prompts the final subscriber
    // to unsubscribe, `_stop` then clears the timer just armed instead of
    // leaving it running with no subscribers.
    this._setLive(true);
  }

  private _start(): void {
    this._isLive = null;
    this._sourceActive = this._config.startSource?.() ?? true;

    // Arm now, not only on the first frame, so a stream already frozen when
    // watching begins is still detected. With no source there is nothing to
    // arm, so nothing is ever reported.
    if (this._sourceActive) {
      this._timer.start(FRAME_STALL_SECONDS, () => this._onStall());
    }
  }

  private _stop(): void {
    this._timer.stop();
    if (this._sourceActive) {
      this._config.stopSource?.();
      this._sourceActive = false;
    }
  }

  private _onStall(): void {
    if (this._config.shouldReportStall()) {
      this._setLive(false);
    }
  }

  private _setLive(isLive: boolean): void {
    if (this._isLive === isLive) {
      return;
    }
    this._isLive = isLive;

    // Snapshot so a callback that unsubscribes while handling the change cannot
    // perturb the iteration.
    [...this._callbacks].forEach((callback) => callback(isLive));
  }
}
