import type { IssueTriggerContext } from 'issue';
import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { Notification } from '../../../config/schema/actions/types.js';
import { localize } from '../../../localize/localize.js';
import { CardIssueManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import { Issue, IssueDescription } from '../types.js';

declare module 'issue' {
  interface IssueTriggerContext {
    media_query: { error: unknown };
  }
}

export class MediaQueryIssue implements Issue {
  public readonly key = 'media_query' as const;

  private _api: CardIssueManagerAPI;
  private _error: NonNullable<unknown> | null = null;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  public trigger(context: IssueTriggerContext['media_query']): void {
    this._error = context.error ?? null;
  }

  public hasIssue(): boolean {
    return this._error !== null;
  }

  public needsRetry(): boolean {
    return this._error !== null;
  }

  public retry(): boolean {
    if (this._error === null) {
      return false;
    }
    this._error = null;
    this._api.getViewManager().setViewByParametersWithNewQuery();

    // Exclusive retry. No other issue should attempt to retry until the next
    // evaluation cycle, when we'll know if this was successful.
    return true;
  }

  public getNotification(): Notification | null {
    if (this._error === null) {
      return null;
    }
    return {
      ...createNotificationFromError(this._error, {
        heading: { text: localize('issues.media_query.heading') },
      }),
      controls: [createRetryControl(this.key)],
    };
  }

  public getIssue(): IssueDescription | null {
    const notification = this.getNotification();
    return notification !== null
      ? { icon: 'mdi:alert', severity: 'high', notification }
      : null;
  }

  public reset(): void {
    this._error = null;
  }
}
