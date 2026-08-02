import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import type { CardIssueManagerAPI } from '../../types';
import { createRetryControl } from '../retry-control.js';
import type { IssueDescription } from '../types';
import { AbstractErrorIssue } from './abstract-error-issue.js';

declare module 'issue' {
  interface IssueTriggerContext {
    initialization: { error: unknown };
  }
}

export class InitializationIssue extends AbstractErrorIssue {
  public readonly key = 'initialization' as const;

  private _api: CardIssueManagerAPI;

  // True while a re-attempt dispatched by retry() is in flight, awaiting its
  // verdict. retry() has to clear _error up front, because the init error is a
  // full-card issue and uniquely initialization refuses to run while one is
  // shown (for good reason), so the error cannot double as the "still
  // unresolved" signal across the re-attempt. This flag carries that signal
  // instead: it keeps needsRetry() true across the gap so the backoff keeps
  // escalating rather than restarting from the base delay each cycle. Cleared
  // when the re-attempt settles -- a failure (trigger) or a success
  // (detectDynamic).
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2579
  private _retrying = false;

  constructor(api: CardIssueManagerAPI) {
    super();
    this._api = api;
  }

  // A fresh failure: the re-attempt has settled, so leave the in-flight state
  // before recording the new error.
  public trigger(context: { error: unknown }): void {
    this._retrying = false;
    super.trigger(context);
  }

  // Clearing the error also abandons any in-flight re-attempt.
  public reset(): void {
    this._retrying = false;
    super.reset();
  }

  public detectDynamic(): void {
    if (!this._api.getInitializationManager().areMandatoryAspectsInitialized()) {
      return;
    }
    // The success settle: mandatory init completed, so there is no error to show
    // and no re-attempt outstanding. Clearing both lets needsRetry() go false and
    // the backoff reset.
    this._error = null;
    this._retrying = false;
  }

  // Unresolved while an error is showing, or while a dispatched re-attempt is
  // still awaiting its verdict. Kept true across that gap so the backoff is not
  // reset mid-sequence.
  public needsRetry(): boolean {
    return this._error !== null || this._retrying;
  }

  // Dispatch a retry only when there is an error to act on and no re-attempt is
  // already running; otherwise wait for the current one to settle.
  public canRetryNow(): boolean {
    return this._error !== null && !this._retrying;
  }

  public retry(): boolean {
    if (this._retrying) {
      // Already awaiting a verdict. Only a forced (user) retry reaches here;
      // scheduled ones are gated by canRetryNow(). Do not tear it down and
      // restart it.
      return false;
    }

    // Enter the in-flight state and clear the error. Removing the error tears
    // down the full-card issue, which is what unblocks initialization from
    // re-attempting (it refuses to start while a full-card issue is shown).
    this._retrying = true;
    this._error = null;

    // Reset init state so initializeMandatory() re-attempts on the next
    // render cycle. destroy() releases the existing CameraManager's held
    // resources (WebSocket subscriptions, listeners) before the CAMERAS
    // init aspect replaces the instance via createCameraManager().
    this._api.getInitializationManager().invalidateMandatoryAspects();
    this._api.getInitializationManager().getSessionManager().end();
    void this._api.getCameraManager().destroy();
    return false;
  }

  public isFullCardIssue(): boolean {
    return true;
  }

  protected _buildDescription(error: NonNullable<unknown>): IssueDescription {
    const notification = createNotificationFromError(error, {
      heading: { text: localize('issues.initialization.heading') },
    });
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: {
        ...notification,
        controls: [createRetryControl(this.key)],
      },
    };
  }
}
