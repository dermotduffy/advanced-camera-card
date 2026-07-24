import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import type { Notification } from '../../../config/schema/actions/types.js';
import { localize } from '../../../localize/localize.js';
import type { CardIssueManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import type { IssueDescription } from '../types.js';
import { AbstractErrorIssue } from './abstract-error-issue.js';

declare module 'issue' {
  interface IssueTriggerContext {
    media_query: { error: unknown };
  }
}

export class MediaQueryIssue extends AbstractErrorIssue {
  public readonly key = 'media_query' as const;

  private _api: CardIssueManagerAPI;

  // True while a retry query is in flight. The error is retained throughout (so
  // the issue stays visible), but no further retry is scheduled until this
  // attempt resolves via a success (reset) or a fresh failure (trigger).
  private _retrying = false;

  constructor(api: CardIssueManagerAPI) {
    super();
    this._api = api;
  }

  // A fresh outcome (success or failure) ends any in-flight retry.
  public trigger(context: { error: unknown }): void {
    this._retrying = false;
    super.trigger(context);
  }

  public reset(): void {
    this._retrying = false;
    super.reset();
  }

  // There is still a failed query to retry as long as an error is present --
  // including while a retry is in flight -- so the backoff keeps escalating
  // across attempts instead of restarting each time one is dispatched.
  public needsRetry(): boolean {
    return this._error !== null;
  }

  // A retry can be dispatched only when one is not already in flight; otherwise
  // the manager waits for the in-flight attempt to succeed or fail.
  public canRetryNow(): boolean {
    return this._error !== null && !this._retrying;
  }

  public retry(): boolean {
    if (this._error === null) {
      return false;
    }

    // An attempt is already running (only a forced retry reaches here while in
    // flight; scheduled ones are gated by canRetryNow). Do not dispatch a second
    // concurrent query -- the retry the caller wants is already happening.
    if (this._retrying) {
      return true;
    }

    // Mark the attempt in flight and keep the error set: it is cleared only on
    // confirmed success, or replaced on the next failure. The 'retry' intent
    // tells the view manager not to clear it up front (see
    // setViewByParametersWithNewQuery). The error must stay visible until it is
    // resolved, without any "flicker"/resetting.
    this._retrying = true;
    this._runRetryQuery().catch(() => {});

    // Exclusive retry. No other issue should attempt to retry until the next
    // evaluation cycle, when we'll know if this was successful.
    return true;
  }

  private async _runRetryQuery(): Promise<void> {
    try {
      await this._api
        .getViewManager()
        .setViewByParametersWithNewQuery({ intent: 'retry' });
    } finally {
      // The attempt has settled. On the normal paths a success (reset) or a
      // failure (trigger) has already cleared this flag; the query is not
      // guaranteed to report either, so clear it here as a fallback.
      this._retrying = false;
    }
  }

  public getNotification(): Notification | null {
    return this.getIssue()?.notification ?? null;
  }

  protected _buildDescription(error: NonNullable<unknown>): IssueDescription {
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: {
        ...createNotificationFromError(error, {
          heading: { text: localize('issues.media_query.heading') },
        }),
        controls: [createRetryControl(this.key)],
      },
    };
  }
}
