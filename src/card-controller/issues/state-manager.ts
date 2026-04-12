import type { IssueTriggerContext } from 'issue';
import { summarizeNotification } from '../../components-lib/notification/summarize';
import { ConditionState } from '../../conditions/types';
import { Notification } from '../../config/schema/actions/types';
import { HomeAssistant } from '../../ha/types';
import { isTruthy } from '../../utils/basic';
import {
  Issue,
  IssueDescription,
  IssueKey,
  IssuePresence,
  IssueTriggerContextKey,
  KeyedIssueDescription,
} from './types';

export class IssueStateManager {
  private _issues = new Map<IssueKey, Issue>();
  private _loggedKeys = new Set<IssueKey>();

  // =========================================================================
  // Setup.
  // =========================================================================

  public addIssue(issue: Issue): void {
    this._issues.set(issue.key, issue);
  }

  // =========================================================================
  // Detection — static (one-shot on init) and dynamic (on every state change).
  // =========================================================================

  public async detectStatic(hass: HomeAssistant): Promise<void> {
    for (const issue of this._issues.values()) {
      await issue.detectStatic?.(hass);
      this._logIfNew(issue);
    }
  }

  public trigger<K extends IssueTriggerContextKey>(
    key: K,
    context: IssueTriggerContext[K],
  ): void {
    this._issues.get(key)?.trigger?.(context);
  }

  public detectDynamic(context: ConditionState): void {
    for (const issue of this._issues.values()) {
      issue.detectDynamic?.(context);
      this._logIfNew(issue);
    }
  }

  // =========================================================================
  // Queries — read active issue state.
  // =========================================================================

  public getFullCardIssue(): IssueDescription | null {
    for (const issue of this._issues.values()) {
      if (issue.hasIssue() && issue.isFullCardIssue?.()) {
        return issue.getIssue();
      }
    }
    return null;
  }

  public hasFullCardIssue(): boolean {
    return !!this.getFullCardIssue();
  }

  public getIssueDescriptions(): KeyedIssueDescription[] {
    const descriptions: KeyedIssueDescription[] = [];
    for (const issue of this._issues.values()) {
      const description = issue.getIssue();
      if (description) {
        descriptions.push({ key: issue.key, issue: description });
      }
    }
    return descriptions;
  }

  public getIssuePresence(): IssuePresence {
    const presence: IssuePresence = new Map();
    for (const issue of this._issues.values()) {
      const description = issue.getIssue();
      if (description) {
        presence.set(issue.key, description);
      }
    }
    return presence;
  }

  public getNotification(key: IssueKey): Notification | null {
    return this._issues.get(key)?.getNotification?.() ?? null;
  }

  // =========================================================================
  // Retry.
  // =========================================================================

  public needsRetry(): boolean {
    return [...this._issues.values()].some((issue) => issue.needsRetry?.());
  }

  public retry(key?: IssueKey, force?: boolean): void {
    const issues = key
      ? [this._issues.get(key)].filter(isTruthy)
      : [...this._issues.values()];

    for (const issue of issues) {
      if (!force && !issue.needsRetry?.()) {
        continue;
      }
      if (issue.retry?.()) {
        return;
      }
    }
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(key?: IssueKey): void {
    const issues = key
      ? [this._issues.get(key)].filter(isTruthy)
      : [...this._issues.values()];

    for (const issue of issues) {
      issue.reset?.();
    }
  }

  public destroy(): void {
    this.reset();
    this._issues.clear();
    this._loggedKeys.clear();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  private _logIfNew(issue: Issue): void {
    if (this._loggedKeys.has(issue.key)) {
      return;
    }
    const description = issue.getIssue();
    if (!description) {
      return;
    }
    this._loggedKeys.add(issue.key);
    const summary = summarizeNotification(description.notification);
    if (summary) {
      console.warn(`Advanced Camera Card [issue=${issue.key}]: ${summary}`);
    }
  }
}
