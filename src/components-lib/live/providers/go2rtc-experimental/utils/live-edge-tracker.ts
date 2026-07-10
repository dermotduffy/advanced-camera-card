// Live-edge chasing for MSE playback.
//
// WebKit (unfortunately) re-buffers whenever `playbackRate` changes, which in
// practice locks playback into slow-motion stutter (see
// https://github.com/dermotduffy/advanced-camera-card/issues/2450). On WebKit
// the playback rate is therefore never touched: when playback falls behind the
// live edge it jumps forward instead, rate-limited by a cooldown. In other
// browsers, the playback rate is nudged up on an exponential curve that stays
// gentle for ordinary drift and only accelerates when playback is far behind,
// clamped so it never drops below realtime.
//
// The numbers below are empirical tuning values, not derived: they trade
// smoothness against how tightly playback tracks the live edge. Adjusting them
// changes that balance, not correctness.

// WebKit: how far behind the live edge (seconds) triggers a forward jump, where
// the jump lands relative to the edge, and the minimum gap between jumps.
const WEBKIT_JUMP_WHEN_BEHIND_SECONDS = 3;
const WEBKIT_JUMP_TARGET_OFFSET_SECONDS = 0.75;
const WEBKIT_JUMP_COOLDOWN_SECONDS = 5;

// Non-WebKit catch-up: the lag (seconds) below which playback stays at realtime,
// how much the adaptive threshold scales with the stream's normal lag, the
// exponential rate curve's scale and steepness, and the rate ceiling.
const CATCH_UP_MIN_LAG_SECONDS = 3;
const CATCH_UP_AVERAGE_LAG_MULTIPLIER = 1.5;
const CATCH_UP_RATE_SCALE = 0.2;
const CATCH_UP_RATE_STEEPNESS = 0.5;
const CATCH_UP_MAX_RATE = 2;

// How many recent lag samples the rolling average spans; a tuning value trading
// responsiveness against noise, not a derived one.
export const LAG_SAMPLE_WINDOW_SIZE = 10;

export type LiveEdgeAction =
  | { action: 'none' }
  | { action: 'rate'; rate: number }
  | { action: 'seek'; seconds: number };

interface LiveEdgeStatus {
  bufferedEndSeconds: number;
  currentTimeSeconds: number;
  playbackRate: number;
  now: Date;
}

// Tracks live-edge lag over successive samples and returns the action needed to
// stay near the live edge: a forward seek (WebKit), a playback-rate nudge
// (other browsers), or no action. Owns the rolling lag average and the WebKit
// jump cooldown.
export class LiveEdgeTracker {
  private _webkit: boolean;
  private _samples: number[] = [];
  private _nextSampleIndex = 0;
  private _lastJumpTime: Date | null = null;

  constructor(options: { webkit: boolean }) {
    this._webkit = options.webkit;
  }

  public next(status: LiveEdgeStatus): LiveEdgeAction {
    const lag = status.bufferedEndSeconds - status.currentTimeSeconds;
    this._sampleLag(lag, status.playbackRate);

    return this._webkit ? this._jumpAction(status, lag) : this._rateAction(lag);
  }

  private _jumpAction(status: LiveEdgeStatus, lag: number): LiveEdgeAction {
    const secondsSinceLastJump =
      this._lastJumpTime === null
        ? null
        : (status.now.getTime() - this._lastJumpTime.getTime()) / 1000;

    if (
      lag > WEBKIT_JUMP_WHEN_BEHIND_SECONDS &&
      (secondsSinceLastJump === null ||
        secondsSinceLastJump >= WEBKIT_JUMP_COOLDOWN_SECONDS)
    ) {
      this._lastJumpTime = status.now;
      return {
        action: 'seek',
        seconds: status.bufferedEndSeconds - WEBKIT_JUMP_TARGET_OFFSET_SECONDS,
      };
    }
    return { action: 'none' };
  }

  private _rateAction(lag: number): LiveEdgeAction {
    if (lag < CATCH_UP_MIN_LAG_SECONDS) {
      return { action: 'rate', rate: 1 };
    }

    // The threshold adapts to the stream's normal lag (e.g. long keyframe
    // intervals make a constant multi-second lag healthy), so the rate only
    // rises when playback is genuinely falling behind.
    const threshold = (this._averageLag() ?? 0) * CATCH_UP_AVERAGE_LAG_MULTIPLIER;
    const rate = Math.min(
      1 + CATCH_UP_RATE_SCALE * Math.exp(CATCH_UP_RATE_STEEPNESS * lag - threshold),
      CATCH_UP_MAX_RATE,
    );
    return { action: 'rate', rate };
  }

  private _sampleLag(lagSeconds: number, playbackRate: number): void {
    // Samples taken while deliberately catching up (rate above realtime and
    // still far behind) would inflate the average the threshold derives from,
    // so they are excluded.
    if (playbackRate !== 1 && lagSeconds >= CATCH_UP_MIN_LAG_SECONDS) {
      return;
    }
    if (this._samples.length < LAG_SAMPLE_WINDOW_SIZE) {
      this._samples.push(lagSeconds);
    } else {
      this._samples[this._nextSampleIndex] = lagSeconds;
      this._nextSampleIndex = (this._nextSampleIndex + 1) % LAG_SAMPLE_WINDOW_SIZE;
    }
  }

  private _averageLag(): number | null {
    if (!this._samples.length) {
      return null;
    }
    return this._samples.reduce((sum, sample) => sum + sample, 0) / this._samples.length;
  }
}
