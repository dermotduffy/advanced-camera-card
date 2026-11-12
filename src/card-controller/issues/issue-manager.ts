import type { IssueResolveContext, IssueTriggerContext } from 'issue';

import type { ConditionStateChange } from '../../condition-trigger/conditions/types';
import { contentsChanged, ignoreFunctionIdentity } from '../../utils/basic';
import { isActionAllowedBasedOnInteractionState } from '../../utils/interaction-mode';
import { RetryTimer } from '../../utils/retry-timer';
import type { CardIssueManagerAPI } from '../types';
import { IssueStateManager } from './state-manager';
import type {
  Issue,
  IssueKey,
  IssuePresence,
  IssueReadOnlyState,
  IssueResolveContextKey,
  IssueTriggerContextKey,
} from './types';

// Exponential backoff schedule for 'auto' retry. The first attempt fires
// quickly so recovery is prompt, then the delay doubles (up to the max) so a
// persistently-failing issue is not retried indefinitely at a tight interval.
export const RETRY_EXPONENTIAL_BASE_SECONDS = 5;
export const RETRY_EXPONENTIAL_MAX_SECONDS = 600;

// Wraps the passive IssueStateManager with reaction logic. A single
// condition-state listener drives everything: it runs one-shot static detection
// when mandatory-init first completes (`everInitialized` becomes true), then
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

  // The issue presence from the last evaluation, compared against on the next
  // one to decide whether a re-render is needed.
  private _lastPresence: IssuePresence = new Map();

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

  // Called by components that observe a problem recovering directly (e.g. a
  // stream that is proven to be delivering media again).
  public resolve<K extends IssueResolveContextKey>(
    key: K,
    context: IssueResolveContext[K],
  ): void {
    this._stateManager.resolve(key, context);
    this.evaluate();
  }

  // Evaluate all dynamic issues against current state, re-render the card if
  // the issue presence changed, and schedule retries.
  //
  // IssuePresence is a Map<IssueKey, IssueDescription>, so comparing the new
  // presence against the previous one catches both presence-set churn (issues
  // appearing/disappearing) and content-level churn (an issue swapping
  // sub-states without changing its key, e.g. ConnectionIssue going from 'lost'
  // to 'starting').
  public evaluate(): void {
    if (this._suspended) {
      return;
    }

    const state = this._api.getConditionStateManager().getState();
    this._stateManager.detectDynamic(state);

    // getIssuePresence() rebuilds notifications fresh each call, so a retry
    // control embeds a new callback closure every time; ignore that identity
    // churn so only an observable change in the issue set or its content
    // triggers a re-render.
    const presence = this._stateManager.getIssuePresence();
    const changed = contentsChanged(
      presence,
      this._lastPresence,
      ignoreFunctionIdentity,
    );
    this._lastPresence = presence;

    if (changed) {
      // Re-render to show the change. The re-render also re-attempts
      // initialization, which matters when a blocking notice like "Home
      // Assistant is starting" clears and the card can finally initialize.
      this._api.getCardElementManager().update();
    }

    this._scheduleRetryIfNeeded();
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
  // `everInitialized` is set when mandatory initialization first completes --
  // see InitializationManager._initializeMandatory -- and is never cleared, so
  // this block runs exactly once however many times the card initializes. That
  // is also the earliest point at which the full HASS object is guaranteed
  // ready for websocket calls (e.g. LegacyResourceIssue's lovelace/resources
  // fetch).
  private _onStateChange(change: ConditionStateChange): void {
    if (change.change.everInitialized === true && change.new.hass) {
      void this._stateManager.detectStatic(change.new.hass).then(() => this.evaluate());
    }
    this.evaluate();
  }

  private _scheduleRetryIfNeeded(): void {
    if (!this._stateManager.needsRetry()) {
      // No issue still has a failing problem, so reset the backoff: a future
      // failure should start again from the base delay.
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

    // Scheduled whether or not a retry can run right now: a hold can end with
    // nothing else happening on the card (e.g. media given time to finish
    // loading), so the timer has to come back and look rather than waiting to
    // be woken. Scheduled without advancing: the backoff only escalates if the
    // retry actually runs (via the explicit advance() below), not when it's
    // held.
    this._retryTimer.schedule(
      () => {
        if (!this._stateManager.needsRetry()) {
          this._retryTimer.reset();
          return;
        }
        if (this._isScheduledRetryAllowed() && this._stateManager.canRetryNow()) {
          this._stateManager.retry();

          // This attempt counts: advance the backoff so the next schedule
          // (re-armed by evaluate() via _scheduleRetryIfNeeded) uses a longer
          // delay. For static-delay mode (base = max, no jitter) advancing is
          // observable in `getAttempts()` but doesn't change the next delay.
          this._retryTimer.advance();
          this.evaluate();
        } else {
          // Retry was gated: the user is interacting, or every issue that needs
          // one is holding off (e.g. media still loading). Nothing was
          // attempted, so the backoff stays put and we re-arm at the same delay
          // rather than escalating towards the ten minute cap for retries that
          // never ran.
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
