import type { ProblemTriggerContext } from 'problem';
import { summarizeNotification } from '../../components-lib/notification/summarize';
import { ConditionState } from '../../conditions/types';
import { Notification } from '../../config/schema/actions/types';
import { HomeAssistant } from '../../ha/types';
import { isTruthy } from '../../utils/basic';
import {
  KeyedProblemDescription,
  Problem,
  ProblemDescription,
  ProblemKey,
  ProblemPresence,
  ProblemTriggerContextKey,
} from './types';

export class ProblemStateManager {
  private _problems = new Map<ProblemKey, Problem>();
  private _loggedKeys = new Set<ProblemKey>();

  // =========================================================================
  // Setup.
  // =========================================================================

  public addProblem(problem: Problem): void {
    this._problems.set(problem.key, problem);
  }

  // =========================================================================
  // Detection — static (one-shot on init) and dynamic (on every state change).
  // =========================================================================

  public async detectStatic(hass: HomeAssistant): Promise<void> {
    for (const problem of this._problems.values()) {
      await problem.detectStatic?.(hass);
      this._logIfNew(problem);
    }
  }

  public trigger<K extends ProblemTriggerContextKey>(
    key: K,
    context: ProblemTriggerContext[K],
  ): void {
    this._problems.get(key)?.trigger?.(context);
  }

  public detectDynamic(context: ConditionState): void {
    for (const problem of this._problems.values()) {
      problem.detectDynamic?.(context);
      this._logIfNew(problem);
    }
  }

  // =========================================================================
  // Queries — read active problem state.
  // =========================================================================

  public getFullCardProblem(): ProblemDescription | null {
    for (const problem of this._problems.values()) {
      if (problem.hasProblem() && problem.isFullCardProblem?.()) {
        return problem.getProblem();
      }
    }
    return null;
  }

  public hasFullCardProblem(): boolean {
    return !!this.getFullCardProblem();
  }

  public getProblemDescriptions(): KeyedProblemDescription[] {
    const descriptions: KeyedProblemDescription[] = [];
    for (const problem of this._problems.values()) {
      const description = problem.getProblem();
      if (description) {
        descriptions.push({ key: problem.key, problem: description });
      }
    }
    return descriptions;
  }

  public getProblemPresence(): ProblemPresence {
    const presence = new Set<ProblemKey>();
    for (const problem of this._problems.values()) {
      if (problem.hasProblem()) {
        presence.add(problem.key);
      }
    }
    return presence;
  }

  public getNotification(key: ProblemKey): Notification | null {
    return this._problems.get(key)?.getNotification?.() ?? null;
  }

  // =========================================================================
  // Retry.
  // =========================================================================

  public needsRetry(): boolean {
    return [...this._problems.values()].some((problem) => problem.needsRetry?.());
  }

  public retry(key?: ProblemKey, force?: boolean): void {
    const problems = key
      ? [this._problems.get(key)].filter(isTruthy)
      : [...this._problems.values()];

    for (const problem of problems) {
      if (!force && !problem.needsRetry?.()) {
        continue;
      }
      if (problem.retry?.()) {
        return;
      }
    }
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(key?: ProblemKey): void {
    const problems = key
      ? [this._problems.get(key)].filter(isTruthy)
      : [...this._problems.values()];

    for (const problem of problems) {
      problem.reset?.();
    }
  }

  public destroy(): void {
    this.reset();
    this._problems.clear();
    this._loggedKeys.clear();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  private _logIfNew(problem: Problem): void {
    if (this._loggedKeys.has(problem.key)) {
      return;
    }
    const description = problem.getProblem();
    if (!description) {
      return;
    }
    this._loggedKeys.add(problem.key);
    const summary = summarizeNotification(description.notification);
    if (summary) {
      console.warn(`Advanced Camera Card: [problem=${problem.key}] ${summary}`);
    }
  }
}
