import type { IssueTriggerContext } from 'issue';
import { ConditionState } from '../../conditions/types';
import { Notification } from '../../config/schema/actions/types';
import { HomeAssistant } from '../../ha/types';
import { Severity } from '../../severity';

export type IssueKey =
  | 'config_error'
  | 'config_upgrade'
  | 'connection'
  | 'initialization'
  | 'legacy_resource'
  | 'media_load'
  | 'media_query'
  | 'view_incompatible';

export interface IssueDescription {
  icon: string;
  severity: Severity;
  notification: Notification;
}

export interface KeyedIssueDescription {
  key: IssueKey;
  issue: IssueDescription;
}

// Map of currently active issues keyed by IssueKey, with each entry's value
// being the issue's current rendered description. Stored as a Map (not just
// a Set of keys) so that sub-state changes within an issue — e.g.
// ConnectionIssue swapping between 'lost' and 'starting' — are reflected as
// real value-level diffs to the condition state, triggering re-renders and
// any user-defined conditions that depend on issue state.
export type IssuePresence = Map<IssueKey, IssueDescription>;
export interface IssueReadOnlyState {
  hasFullCardIssue(): boolean;
  getFullCardIssue(): IssueDescription | null;
  getIssueDescriptions(): KeyedIssueDescription[];
  getIssuePresence(): IssuePresence;
}

export type IssueTriggerContextKey = keyof IssueTriggerContext;
export type IssueTriggerEventData = {
  [K in IssueTriggerContextKey]: { key: K } & IssueTriggerContext[K];
}[IssueTriggerContextKey];

export interface Issue {
  readonly key: IssueKey;

  // One-time async detection (WS calls, config checks).
  detectStatic?(hass?: HomeAssistant): Promise<void>;

  // Ongoing sync evaluation, called on state changes.
  detectDynamic?(context: ConditionState): void;

  // Explicitly trigger this issue with key-specific context.
  trigger?(context: IssueTriggerContext[IssueTriggerContextKey]): void;

  hasIssue(): boolean;
  getIssue(): IssueDescription | null;

  // Whether this issue renders as a full-card display when active. Defaults
  // to false when absent (popup notification). Issues that take over the
  // entire card must explicitly return true.
  isFullCardIssue?(): boolean;

  // Return notification content regardless of active state, for user-initiated
  // queries (e.g. clicking a loading icon). May return null when content
  // depends on transient state (e.g. no current error to show).
  getNotification?(): Notification | null;

  // Whether this issue wants the manager to schedule a retry. Gates
  // scheduled retries; user-initiated (forced) retries bypass this check.
  needsRetry?(): boolean;

  // Called by the manager when a retry is due. Returns true to stop the retry
  // loop (exclusive), false to allow subsequent issues to also retry.
  retry?(): boolean;

  // Optional user-initiated fix. Not called by the issue infrastructure —
  // callers (e.g. notification control actions) invoke this directly.
  fix?(hass: HomeAssistant): Promise<boolean>;

  // Reset internal state (clear errors, stop timers, etc.).
  reset?(): void;
}
