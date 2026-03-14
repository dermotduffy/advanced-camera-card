import { Notification } from '../../config/schema/actions/types';
import { AdvancedCameraCardView } from '../../config/schema/common/const';
import { HomeAssistant } from '../../ha/types';
import { Severity } from '../../severity';

export type ProblemKey = 'config_upgrade' | 'legacy_resource' | 'stream_not_loading';

export interface ProblemResult {
  icon: string;
  severity: Severity;
  notification: Notification;
}

export interface KeyedProblemResult {
  key: ProblemKey;
  problem: ProblemResult;
}

export type ProblemPresence = Partial<Record<ProblemKey, boolean>>;

export interface ProblemDynamicContext {
  cameraID?: string;
  view?: AdvancedCameraCardView;
  mediaLoaded: boolean;
}

export interface ProblemTriggerContext {
  cameraID?: string;
}

export type ProblemTriggerEventData = { key: ProblemKey } & ProblemTriggerContext;

export interface Problem {
  readonly key: ProblemKey;

  // One-time async detection (WS calls, config checks).
  detectStatic?(hass?: HomeAssistant): Promise<void>;

  // Ongoing sync evaluation, called on state changes.
  detectDynamic?(context: ProblemDynamicContext): void;

  // Explicitly trigger this problem.
  trigger?(context?: ProblemTriggerContext): void;

  hasResult(): boolean;
  getResult(): ProblemResult | null;

  // Return notification content regardless of active state, for
  // user-initiated queries (e.g. clicking a loading icon).
  getNotification?(): Notification | null;

  // Optional automatic fixing.
  fix?(hass: HomeAssistant): Promise<boolean>;

  // Cleanup.
  destroy?(): void;
}
