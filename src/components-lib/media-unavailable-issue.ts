import type { IssueResolveContext, IssueTriggerContext } from 'issue';

import type {
  IssueResolveEventData,
  IssueTriggerEventData,
} from '../card-controller/issues/types';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event';

// The `media_unavailable` issue holds one failure per target, and several
// components trigger and resolve it for the same target. These events are
// statements of observed fact, not paired open/close operations:
//
// - A statement must be true when made: trigger only a failure that was
//   observed, and resolve only what the observed evidence disproves, naming a
//   `reason` to narrow the resolve to exactly that.
// - Statements are idempotent. Two components observing the same recovery may
//   both resolve; the second changes nothing.
// - A failure is not necessarily resolved by the component that triggered it.
//   That component may since have been replaced (e.g. a retry rebuilding a
//   provider), so recovery is stated by whichever component observes it.

/**
 * Trigger the `media_unavailable` issue for a target, naming what went wrong.
 */
export function triggerMediaUnavailableIssue(
  element: EventTarget,
  context: IssueTriggerContext['media_unavailable'],
): void {
  fireAdvancedCameraCardEvent<IssueTriggerEventData>(element, 'issue:trigger', {
    key: 'media_unavailable',
    ...context,
  });
}

/**
 * Resolve a target's `media_unavailable` issue. Naming a reason leaves an issue
 * triggered for any other reason in place.
 */
export function resolveMediaUnavailableIssue(
  element: EventTarget,
  context: IssueResolveContext['media_unavailable'],
): void {
  fireAdvancedCameraCardEvent<IssueResolveEventData>(element, 'issue:resolve', {
    key: 'media_unavailable',
    ...context,
  });
}
