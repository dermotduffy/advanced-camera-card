import type { IssueTriggerContext } from 'issue';
import { isActionAllowedBasedOnInteractionState } from '../../utils/interaction-mode';
import { Timer } from '../../utils/timer';
import { CardIssueManagerAPI } from '../types';
import { IssueStateManager } from './state-manager';
import { Issue, IssueKey, IssueTriggerContextKey } from './types';

// Exponential backoff schedule for 'auto' retry. The base is set above the
// per-media retry threshold (~10s) so the issue-level backoff kicks in *after*
// lower-level recovery has had a chance to work, not in parallel with it.
export const RETRY_EXPONENTIAL_BASE_SECONDS = 30;
export const RETRY_EXPONENTIAL_MAX_SECONDS = 600;
const RETRY_EXPONENTIAL_JITTER_MIN = 0.5;
const RETRY_EXPONENTIAL_JITTER_MAX = 1.0;

// Wraps the passive IssueStateManager with reaction logic: evaluates issues
// on state changes, schedules retries, and updates the card. Full-card issues
// are rendered by card.ts via getStateManager().getFullCardIssue(). Non-full-
// card issue notifications are shown on demand via showNotification().
export class IssueManager {
  private _api: CardIssueManagerAPI;
  private _stateManager = new IssueStateManager();
  private _retryTimer = new Timer();
  private _retryAttempt = 0;
  private _suspended = false;

  // Reentrancy guard: evaluate() calls setState() on the condition state
  // manager, which fires listeners synchronously — including the one
  // registered in this constructor. Without this guard, detectDynamic()
  // and presence computation would run twice per evaluation.
  private _evaluating = false;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
    api.getConditionStateManager().addListener(() => this.evaluate());
  }

  // =========================================================================
  // Setup.
  // =========================================================================

  public addIssue(issue: Issue): void {
    this._stateManager.addIssue(issue);
  }

  public getStateManager(): IssueStateManager {
    return this._stateManager;
  }

  // =========================================================================
  // Detection & reaction.
  // =========================================================================

  // Called by components that detect an issue directly (e.g. a provider
  // error event), bypassing the condition-state polling loop.
  public trigger<K extends IssueTriggerContextKey>(
    key: K,
    context: IssueTriggerContext[K],
  ): void {
    this._stateManager.trigger(key, context);
    this.evaluate();
  }

  // Evaluate all dynamic issues against current state, then react to any
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
          issues: this._stateManager.getIssuePresence(),
        })
      ) {
        this._api.getCardElementManager().update();
      }

      this._scheduleRetryIfNeeded();
    } finally {
      this._evaluating = false;
    }
  }

  public retry(key: IssueKey, force?: boolean): void {
    this._stateManager.retry(key, force);
    this._retryTimer.stop();
    this.evaluate();
  }

  // Show the notification for an issue on demand (e.g. user clicks a loading
  // icon) regardless of whether the issue is currently active.
  public showNotification(key: IssueKey): void {
    const notification = this._stateManager.getNotification(key);
    if (notification) {
      this._api.getNotificationManager().setNotification(notification);
    }
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(key?: IssueKey): void {
    // When resetting a specific key that has no active issue, skip the
    // reset+evaluate cycle entirely to avoid unnecessary work.
    if (key && !this._stateManager.getIssuePresence().has(key)) {
      return;
    }
    this._stateManager.reset(key);
    this.evaluate();
  }

  // Gate evaluation while the card is detached so timers don't arm or mature
  // offscreen. Issue state is preserved (including full-card issues like
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
      this._retryAttempt = 0;
      return;
    }
    if (this._retryTimer.isRunning()) {
      return;
    }

    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      this._retryAttempt = 0;
      return;
    }
    const delaySeconds = this._nextRetryDelaySeconds(config.view.issues.retry_seconds);
    if (delaySeconds === null) {
      this._retryAttempt = 0;
      return;
    }

    this._retryTimer.start(delaySeconds, () => {
      if (!this._stateManager.needsRetry()) {
        this._retryAttempt = 0;
        return;
      }
      if (this._isScheduledRetryAllowed()) {
        this._stateManager.retry();
        this._retryAttempt++;
        // evaluate() re-arms the timer via _scheduleRetryIfNeeded.
        this.evaluate();
      } else {
        // Retry was gated (e.g. user interaction). This isn't a failed attempt
        // so don't increment — re-arm at the same delay.
        this._scheduleRetryIfNeeded();
      }
    });
  }

  private _nextRetryDelaySeconds(retryConfig: 'auto' | number): number | null {
    if (typeof retryConfig === 'number') {
      return retryConfig === 0 ? null : retryConfig;
    }

    // 'auto': exponential backoff, capped, with jitter to avoid thundering-herd
    // when multiple cards retry the same backend in lockstep.
    const exp = Math.min(
      RETRY_EXPONENTIAL_MAX_SECONDS,
      RETRY_EXPONENTIAL_BASE_SECONDS * 2 ** this._retryAttempt,
    );
    const jitter =
      RETRY_EXPONENTIAL_JITTER_MIN +
      Math.random() * (RETRY_EXPONENTIAL_JITTER_MAX - RETRY_EXPONENTIAL_JITTER_MIN);
    return exp * jitter;
  }

  private _isScheduledRetryAllowed(): boolean {
    const interactionMode = this._api.getConfigManager().getConfig()?.view
      .issues.interaction_mode;
    return (
      !!interactionMode &&
      isActionAllowedBasedOnInteractionState(
        interactionMode,
        this._api.getInteractionManager().hasInteraction(),
      )
    );
  }
}
