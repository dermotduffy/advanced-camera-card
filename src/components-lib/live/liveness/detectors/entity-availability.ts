import { isEqual } from 'lodash-es';

import type { StateWatcherSubscriptionInterface } from '../../../../card-controller/hass/state-watcher';
import type { HassStateDifference, HomeAssistant } from '../../../../ha/types';
import { Timer } from '../../../../utils/timer';
import type { LivenessDetector, LivenessVerdict } from '../stream-liveness-controller';

// A camera entity must stay `unavailable` this long before the stream is
// treated as lost. Shorter blips (e.g. during PTZ, see issue #2124) are
// tolerated.
export const LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS = 10;

interface EntityAvailabilityDetectorConfig {
  getHASS: () => HomeAssistant | null;
  getStateWatcher: () => StateWatcherSubscriptionInterface | null;
  getCameraEntity: () => string | null;

  // `always_error_if_entity_unavailable` (issue #1650): report the loss with no
  // grace tolerance, so any unavailability surfaces immediately.
  isAlwaysError: () => boolean;

  onChange: () => void;
}

/**
 * Detects a silent freeze via the camera entity: a `camera_entity` that stays
 * `unavailable` past the grace window (e.g. a Frigate restart or camera
 * power-cycle) is reported as not live (asking for a reconnecting placeholder),
 * and live again when it returns. Observes the entity via StateWatcher (an event
 * subscription), not by polling.
 */
export class EntityAvailabilityDetector implements LivenessDetector {
  private _config: EntityAvailabilityDetectorConfig;
  private _timer = new Timer();

  private _active = false;
  private _watchedEntity: string | null = null;
  private _verdict: LivenessVerdict = { state: 'unknown' };

  constructor(config: EntityAvailabilityDetectorConfig) {
    this._config = config;
  }

  public subscribe(): void {
    this._active = true;
    this._watch();
  }

  public unsubscribe(): void {
    // Stop watching and pause the grace timer, but keep `_verdict` so a
    // reconnect resumes rather than restarts.
    this._active = false;
    this._config.getStateWatcher()?.unsubscribe(this._onEntityStateChange);
    this._watchedEntity = null;
    this._timer.stop();
  }

  public reset(): void {
    // Re-point the subscription at the (possibly different) camera entity and
    // start fresh.
    this._verdict = { state: 'unknown' };
    this._timer.stop();
    this._watch();
  }

  public getVerdict(): LivenessVerdict {
    return this._verdict;
  }

  // Point the subscription at the current camera entity and re-check its state.
  private _watch(): void {
    if (!this._active) {
      return;
    }
    const stateWatcher = this._config.getStateWatcher();
    const entityID = this._config.getCameraEntity();
    if (entityID !== this._watchedEntity) {
      stateWatcher?.unsubscribe(this._onEntityStateChange);
      this._watchedEntity = entityID;
      if (entityID) {
        stateWatcher?.subscribe(this._onEntityStateChange, [entityID]);
      }
    }
    this._check();
  }

  private _onEntityStateChange = (difference: HassStateDifference): void =>
    // Trap: Evaluate the state carried by the event, not `getHASS()`: the
    // StateWatcher fires synchronously from the card-level hass update, before
    // the wrapper's `hass` prop (what `getHASS()` reads) has propagated via
    // Lit, so re-reading it would still see the pre-change state and miss the
    // transition.
    this._evaluate(difference.newState.state);

  private _check(): void {
    const stateObj = this._watchedEntity
      ? this._config.getHASS()?.states[this._watchedEntity]
      : undefined;
    this._evaluate(stateObj?.state);
  }

  private _evaluate(state?: string): void {
    if (state === 'unavailable') {
      if (this._config.isAlwaysError()) {
        // No grace time, and authoritative (overrides direct frame evidence):
        // the user opted into treating any unavailability as an error.
        this._setVerdict({
          state: 'not_live',
          authority: 'hard',
          renderPlaceholder: true,
          reason: 'entity_unavailable',
        });
      } else if (this._verdict.state !== 'not_live' && !this._timer.isRunning()) {
        // Wait out the grace window before declaring the stream lost, so short
        // blips are tolerated. This is only an indirect signal of stream health,
        // so it is suppressed when the media itself is confirmed live (frames
        // arriving).
        this._timer.start(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS, () =>
          this._setVerdict({
            state: 'not_live',
            authority: 'indirect',
            renderPlaceholder: true,
            reason: 'entity_unavailable',
          }),
        );
      }
    } else {
      // Entity available is not positive proof the stream is live (it can be
      // available while the stream is frozen), so report `unknown`, not `live`.
      this._timer.stop();
      this._setVerdict({ state: 'unknown' });
    }
  }

  private _setVerdict(verdict: LivenessVerdict): void {
    if (isEqual(this._verdict, verdict)) {
      return;
    }
    this._verdict = verdict;
    this._config.onChange();
  }
}
