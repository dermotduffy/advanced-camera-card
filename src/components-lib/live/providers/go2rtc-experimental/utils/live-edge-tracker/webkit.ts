// WebKit re-buffers whenever `playbackRate` changes, which in practice locks
// playback into 1fps slow-motion stutter (see
// https://github.com/dermotduffy/advanced-camera-card/issues/2450), so this
// strategy never touches the rate and manages position with seeks instead.

import { GOPCadenceEstimator } from './gop-cadence-estimator';
import type { LiveEdgeAction, LiveEdgeStatus, LiveEdgeStrategy } from './types';

// How many GOPs behind the live edge to hold playback, and the band (seconds)
// that hold-back is clamped to so an anomalous GOP estimate cannot pin playback
// at the edge or strand it far behind live.
const HOLDBACK_GOP_MULTIPLIER = 3;
const MIN_HOLDBACK_SECONDS = 1.5;
const MAX_HOLDBACK_SECONDS = 8;

// How far past the hold-back (in GOPs) playback must fall before a forward
// catch-up seek, and the minimum gap between such seeks.
const CATCHUP_EXCESS_GOP_MULTIPLIER = 2;
const JUMP_COOLDOWN_SECONDS = 5;

// Hold playback a few GOPs behind the live edge. Sitting too close lets the
// playhead outrun the bursty per-keyframe delivery and reach the buffered end,
// at which point WebKit stalls into a pause a muted stream cannot auto-resume.
// The hold-back is sized to the measured GOP cadence, since staying under
// roughly three GOPs behind live lets a delivery gap drain the buffer and
// stall. Playback is seeked forward only when it has fallen well behind the
// hold-back, and back toward it when it drifts within one GOP of the edge.
export class WebKitLiveEdgeStrategy implements LiveEdgeStrategy {
  private _cadence = new GOPCadenceEstimator();
  private _lastJumpTime: Date | null = null;

  public next(status: LiveEdgeStatus): LiveEdgeAction {
    this._cadence.sample(status.bufferedEndSeconds, status.now);

    const lag = status.bufferedEndSeconds - status.currentTimeSeconds;
    const gop = this._cadence.estimateSeconds();
    const holdback = this._holdbackSeconds(gop);
    const target = status.bufferedEndSeconds - holdback;

    // Playback has drifted within one GOP of the edge and is about to starve.
    // WebKit cannot slow down with playbackRate to avoid it, so seek back to the
    // hold-back to restore runway before it stalls into a pause. Not
    // cooldown-gated: avoiding the stall takes priority over jump spacing.
    if (lag < gop) {
      return { action: 'seek', seconds: target };
    }

    // Playback has fallen well behind the hold-back (e.g. after a background
    // tab): jump forward to the hold-back, rate-limited by a cooldown.
    const secondsSinceLastJump =
      this._lastJumpTime === null
        ? null
        : (status.now.getTime() - this._lastJumpTime.getTime()) / 1000;

    if (
      lag > holdback + CATCHUP_EXCESS_GOP_MULTIPLIER * gop &&
      (secondsSinceLastJump === null || secondsSinceLastJump >= JUMP_COOLDOWN_SECONDS)
    ) {
      this._lastJumpTime = status.now;
      return { action: 'seek', seconds: target };
    }

    return { action: 'none' };
  }

  private _holdbackSeconds(gopSeconds: number): number {
    return Math.min(
      Math.max(HOLDBACK_GOP_MULTIPLIER * gopSeconds, MIN_HOLDBACK_SECONDS),
      MAX_HOLDBACK_SECONDS,
    );
  }
}
