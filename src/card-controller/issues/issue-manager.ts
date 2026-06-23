import type { IssueTriggerContext } from 'issue';
import { ConditionStateChange } from '../../condition-trigger/conditions/types';
import { isActionAllowedBasedOnInteractionState } from '../../utils/interaction-mode';
import { RetryTimer } from '../../utils/retry-timer';
import { CardIssueManagerAPI } from '../types';
import { IssueStateManager } from './state-manager';
import { Issue, IssueKey, IssueReadOnlyState, IssueTriggerContextKey } from './types';

// Exponential backoff schedule for 'auto' retry. The base is set above the
// per-media retry threshold (~10s) so the issue-level backoff kicks in *after*
// lower-level recovery has had a chance to work, not in parallel with it.
export const RETRY_EXPONENTIAL_BASE_SECONDS = 30;
export const RETRY_EXPONENTIAL_MAX_SECONDS = 600;

// Wraps the passive IssueStateManager with reaction logic. A single
// condition-state listener drives everything: it runs one-shot static detection
// when mandatory-init completes (`initialized` transitions to true), then
// evaluates dynamic issues on every subsequent state change, schedules retries,
// and updates the card. Full-card issues are rendered by card.ts via
// getStateManager().getFullCardIssue(). Non-full-card issue notifications are
// shown on demand via showNotification().
export class IssueManager {
  private _api: CardIssueManagerAPI;
  private _stateManager = new IssueStateManager();
  private _retryTimer = new RetryTimer({
    baseSeconds: RETRY_EXPONENTIAL_BASE_SECONDS,
    maxSeconds: RETRY_EXPONENTIAL_MAX_SECONDS,
  });
  private _suspended = false;

  // Reentrancy guard: evaluate() calls setState() on the condition state
  // manager, which fires listeners synchronously -- including the one
  // registered in this constructor. Without this guard, detectDynamic()
  // and presence computation would run twice per evaluation.
  private _evaluating = false;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
    api.getConditionStateManager().addListener((change) => this._onStateChange(change));
  }

  // =========================================================================
  // Setup.
  // =========================================================================

  public addIssue(issue: Issue): void {
    this._stateManager.addIssue(issue);
  }

  public getStateManager(): IssueReadOnlyState {
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
  //
  // Detection of "anything changed" is delegated to the condition state
  // manager: IssuePresence is a Map<IssueKey, IssueDescription>, so its
  // deep equality check naturally catches both presence-set churn (issues
  // appearing/disappearing) and content-level churn (an issue swapping
  // sub-states without changing its key, e.g. ConnectionIssue going from
  // 'lost' to 'starting').
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
        // Re-render to show the change. The re-render also re-attempts
        // initialization, which matters when a blocking notice like "Home
        // Assistant is starting" clears and the card can finally initialize.
        this._api.getCardElementManager().update();
      }

      this._scheduleRetryIfNeeded();
    } finally {
      this._evaluating = false;
    }
  }

  // Attempts a retry for the given issue. Pass `force = true` for user-
  // initiated retries (e.g. clicking the retry button on a notification): it
  // bypasses the `needsRetry()` gate that scheduled auto-retries must
  // respect, so even an issue that doesn't currently want a retry will run
  // its `retry()` method. Also stops the pending auto-retry timer so the
  // user action resets the backoff schedule.
  public retry(key: IssueKey, force?: boolean): void {
    this._stateManager.retry(key, force);
    this._retryTimer.reset();
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
  // config_error). Issue-internal timers are stopped via Issue.suspend so
  // offscreen time doesn't count against age-based thresholds (e.g. media
  // loading timeout). Evaluation resumes on resume().
  public suspend(): void {
    this._suspended = true;
    this._retryTimer.cancel();
    this._stateManager.suspend();
  }

  public resume(): void {
    this._suspended = false;
    this.evaluate();
  }

  public destroy(): void {
    this._retryTimer.cancel();
    this._stateManager.destroy();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  // Drives both one-shot static detection (on mandatory-init completion) and
  // normal re-evaluation (on any condition-state change).
  //
  // `initialized: true` in the change payload means mandatory initialization
  // just finished -- see InitializationManager._initializeMandatory. That's
  // also the earliest point at which the full HASS object is guaranteed
  // ready for websocket calls (e.g. LegacyResourceIssue's lovelace/resources
  // fetch). Because `initialized` is latched (its comment notes it never
  // changes again), this block fires exactly once per IssueManager life.
  private _onStateChange(change: ConditionStateChange): void {
    if (change.change.initialized === true && change.new.hass) {
      /* async */ this._stateManager
        .detectStatic(change.new.hass)
        .then(() => this.evaluate());
    }
    this.evaluate();
  }

  private _scheduleRetryIfNeeded(): void {
    if (!this._stateManager.needsRetry()) {
      this._retryTimer.reset();
      return;
    }
    if (this._retryTimer.isRunning()) {
      return;
    }

    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      this._retryTimer.reset();
      return;
    }

    const retryConfig = config.view.issues.retry_seconds;
    if (retryConfig === 0) {
      this._retryTimer.reset();
      return;
    }

    this._retryTimer.setOptions(
      retryConfig === 'auto'
        ? {
            baseSeconds: RETRY_EXPONENTIAL_BASE_SECONDS,
            maxSeconds: RETRY_EXPONENTIAL_MAX_SECONDS,
          }
        : retryConfig,
    );

    // Schedule without advancing: the backoff only escalates if the retry
    // actually runs (via the explicit advance() below), not when it's gated.
    this._retryTimer.schedule(
      () => {
        if (!this._stateManager.needsRetry()) {
          this._retryTimer.reset();
          return;
        }
        if (this._isScheduledRetryAllowed()) {
          this._stateManager.retry();

          // This attempt counts: advance the backoff so the next schedule
          // (re-armed by evaluate() via _scheduleRetryIfNeeded) uses a longer
          // delay. For static-delay mode (base = max, no jitter) advancing is
          // observable in `getAttempts()` but doesn't change the next delay.
          this._retryTimer.advance();
          this.evaluate();
        } else {
          // Retry was gated (e.g. user interaction). Not a failed attempt; the
          // backoff stays put and we re-arm at the same delay.
          this._scheduleRetryIfNeeded();
        }
      },
      { advance: false },
    );
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
