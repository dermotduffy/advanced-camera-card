import type { ProblemTriggerContext } from 'problem';
import { ConditionState } from '../../conditions/types';
import { Notification } from '../../config/schema/actions/types';
import { HomeAssistant } from '../../ha/types';
import { Severity } from '../../severity';

export type ProblemKey =
  | 'config_error'
  | 'config_upgrade'
  | 'connection'
  | 'initialization'
  | 'legacy_resource'
  | 'media_load'
  | 'media_query';

export interface ProblemDescription {
  icon: string;
  severity: Severity;
  notification: Notification;
}

export interface KeyedProblemDescription {
  key: ProblemKey;
  problem: ProblemDescription;
}

export type ProblemPresence = Set<ProblemKey>;

export type ProblemTriggerContextKey = keyof ProblemTriggerContext;
export type ProblemTriggerEventData = {
  [K in ProblemTriggerContextKey]: { key: K } & ProblemTriggerContext[K];
}[ProblemTriggerContextKey];

export interface Problem {
  readonly key: ProblemKey;

  // One-time async detection (WS calls, config checks).
  detectStatic?(hass?: HomeAssistant): Promise<void>;

  // Ongoing sync evaluation, called on state changes.
  detectDynamic?(context: ConditionState): void;

  // Explicitly trigger this problem with key-specific context.
  trigger?(context: ProblemTriggerContext[ProblemTriggerContextKey]): void;

  hasProblem(): boolean;
  getProblem(): ProblemDescription | null;

  // Whether this problem renders as a full-card display when active. Defaults
  // to false when absent (popup notification). Problems that take over the
  // entire card must explicitly return true.
  isFullCardProblem?(): boolean;

  // Return notification content regardless of active state, for user-initiated
  // queries (e.g. clicking a loading icon). May return null when content
  // depends on transient state (e.g. no current error to show).
  getNotification?(): Notification | null;

  // Whether this problem wants the manager to schedule a retry. Gates
  // scheduled retries; user-initiated (forced) retries bypass this check.
  needsRetry?(): boolean;

  // Called by the manager when a retry is due. Returns true to stop the retry
  // loop (exclusive), false to allow subsequent problems to also retry.
  retry?(): boolean;

  // Optional user-initiated fix. Not called by the problem infrastructure —
  // callers (e.g. notification control actions) invoke this directly.
  fix?(hass: HomeAssistant): Promise<boolean>;

  // Reset internal state (clear errors, stop timers, etc.).
  reset?(): void;
}
