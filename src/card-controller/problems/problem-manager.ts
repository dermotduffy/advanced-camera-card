import type { ProblemTriggerContext } from 'problem';
import { isActionAllowedBasedOnInteractionState } from '../../utils/interaction-mode';
import { Timer } from '../../utils/timer';
import { CardProblemManagerAPI } from '../types';
import { ProblemStateManager } from './state-manager';
import { Problem, ProblemKey, ProblemTriggerContextKey } from './types';

// Wraps the passive ProblemStateManager with reaction logic: evaluates problems
// on state changes, schedules retries, and updates the card. Full-card problems
// are rendered by card.ts via getStateManager().getFullCardProblem(). Non-full-
// card problem notifications are shown on demand via showNotification().
export class ProblemManager {
  private _api: CardProblemManagerAPI;
  private _stateManager = new ProblemStateManager();
  private _retryTimer = new Timer();
  private _suspended = false;

  // Reentrancy guard: evaluate() calls setState() on the condition state
  // manager, which fires listeners synchronously — including the one
  // registered in this constructor. Without this guard, detectDynamic()
  // and presence computation would run twice per evaluation.
  private _evaluating = false;

  constructor(api: CardProblemManagerAPI) {
    this._api = api;
    api.getConditionStateManager().addListener(() => this.evaluate());
  }

  // =========================================================================
  // Setup.
  // =========================================================================

  public addProblem(problem: Problem): void {
    this._stateManager.addProblem(problem);
  }

  public getStateManager(): ProblemStateManager {
    return this._stateManager;
  }

  // =========================================================================
  // Detection & reaction.
  // =========================================================================

  // Called by components that detect a problem directly (e.g. a provider
  // error event), bypassing the condition-state polling loop.
  public trigger<K extends ProblemTriggerContextKey>(
    key: K,
    context: ProblemTriggerContext[K],
  ): void {
    this._stateManager.trigger(key, context);
    this.evaluate();
  }

  // Evaluate all dynamic problems against current state, then react to any
  // changes: notify, update condition state, and schedule retries.
  public evaluate(): void {
    if (this._suspended || this._evaluating) {
      return;
    }

    this._evaluating = true;
    try {
      const state = this._api.getConditionStateManager().getState();
      this._stateManager.detectDynamic(state);

      if (
        this._api.getConditionStateManager().setState({
          problems: this._stateManager.getProblemPresence(),
        })
      ) {
        this._api.getCardElementManager().update();
      }

      this._scheduleRetryIfNeeded();
    } finally {
      this._evaluating = false;
    }
  }

  public retry(key: ProblemKey, force?: boolean): void {
    this._stateManager.retry(key, force);
    this._retryTimer.stop();
    this.evaluate();
  }

  // Show the notification for a problem on demand (e.g. user clicks a loading
  // icon) regardless of whether the problem is currently active.
  public showNotification(key: ProblemKey): void {
    const notification = this._stateManager.getNotification(key);
    if (notification) {
      this._api.getNotificationManager().setNotification(notification);
    }
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(key?: ProblemKey): void {
    // When resetting a specific key that has no active problem, skip the
    // reset+evaluate cycle entirely to avoid unnecessary work.
    if (key && !this._stateManager.getProblemPresence().has(key)) {
      return;
    }
    this._stateManager.reset(key);
    this.evaluate();
  }

  // Gate evaluation while the card is detached so timers don't arm or mature
  // offscreen. Problem state is preserved (including full-card problems like
  // config_error). Evaluation resumes on resume().
  public suspend(): void {
    this._suspended = true;
    this._retryTimer.stop();
  }

  public resume(): void {
    this._suspended = false;
    this.evaluate();
  }

  public destroy(): void {
    this._retryTimer.stop();
    this._stateManager.destroy();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  private _scheduleRetryIfNeeded(): void {
    if (!this._stateManager.needsRetry()) {
      this._retryTimer.stop();
      return;
    }
    const retrySeconds =
      this._api.getConfigManager().getConfig()?.view.errors.retry_seconds ?? 0;
    if (retrySeconds <= 0 || this._retryTimer.isRunning()) {
      return;
    }
    this._retryTimer.startRepeated(retrySeconds, () => {
      if (!this._stateManager.needsRetry()) {
        this._retryTimer.stop();
        return;
      }
      if (this._isScheduledRetryAllowed()) {
        this._stateManager.retry();
        this.evaluate();
      }
    });
  }

  private _isScheduledRetryAllowed(): boolean {
    const interactionMode = this._api.getConfigManager().getConfig()?.view
      .errors.interaction_mode;
    return (
      !!interactionMode &&
      isActionAllowedBasedOnInteractionState(
        interactionMode,
        this._api.getInteractionManager().hasInteraction(),
      )
    );
  }
}
