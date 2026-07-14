// Everything that is not WebKit: keep playback near the live edge by nudging the
// playback rate (the approach WebKit cannot use; see ./webkit.ts).

import type { LiveEdgeAction, LiveEdgeStatus, LiveEdgeStrategy } from './types';

// The lag (seconds) below which playback stays at realtime, how much the
// adaptive threshold scales with the stream's normal lag, the exponential rate
// curve's scale and steepness, and the rate ceiling.
const CATCH_UP_MIN_LAG_SECONDS = 3;
const CATCH_UP_AVERAGE_LAG_MULTIPLIER = 1.5;
const CATCH_UP_RATE_SCALE = 0.2;
const CATCH_UP_RATE_STEEPNESS = 0.5;
const CATCH_UP_MAX_RATE = 2;

// How many recent lag samples the rolling average spans; a tuning value trading
// responsiveness against noise, not a derived one.
export const LAG_SAMPLE_WINDOW_SIZE = 10;

// Nudge the playback rate up on an exponential curve that stays gentle for
// ordinary drift and only accelerates when playback is far behind, clamped so it
// never drops below realtime.
export class NonWebKitLiveEdgeStrategy implements LiveEdgeStrategy {
  private _samples: number[] = [];
  private _nextSampleIndex = 0;

  public next(status: LiveEdgeStatus): LiveEdgeAction {
    const lag = status.bufferedEndSeconds - status.currentTimeSeconds;
    this._sampleLag(lag, status.playbackRate);

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
