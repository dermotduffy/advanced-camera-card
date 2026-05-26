import { computeDomain } from './compute-domain';
import { isTriggeredState } from './is-triggered-state';
import { HassStateDifference } from './types';

// New state must be a real timestamp: `unavailable` means the entity went
// offline, `unknown` means it has no recorded fire -- neither is a fresh fire.
const isUsableNewState = (state: string): boolean =>
  state !== 'unavailable' && state !== 'unknown';

// Old state must be defined and not `unavailable`. `unknown` is allowed -- it
// means the entity was alive but had never fired, so the new timestamp is a
// real first fire (not a restored last-fire-time after reconnect).
const isUsableOldState = (state: string | undefined): boolean =>
  state !== undefined && state !== 'unavailable';

/**
 * Map a watched entity's state change to the `CameraEvent` type to dispatch
 * for it, or `null` to skip.
 *
 * Most entities have an "on"/"off" state (e.g. `binary_sensor`, `switch`) and
 * produce a single `'new'` or `'end'`.
 *
 * HA `event.*` entities are different: each fire just updates `state` to a new
 * ISO timestamp, with no continuous on/off. Those map to `momentary` -- the
 * instantaneous-event discriminator. Transitions are skipped when the old state
 * is undefined (entity not previously observed) or `unavailable` (entity
 * reconnecting -- new state could be restored, not fresh), or when the new
 * state isn't a real timestamp.
 */
export const getTriggerEventType = (
  difference: HassStateDifference,
): 'new' | 'end' | 'momentary' | null => {
  if (computeDomain(difference.entityID) === 'event') {
    return isUsableOldState(difference.oldState?.state) &&
      isUsableNewState(difference.newState.state)
      ? 'momentary'
      : null;
  }
  return isTriggeredState(difference.newState.state) ? 'new' : 'end';
};
