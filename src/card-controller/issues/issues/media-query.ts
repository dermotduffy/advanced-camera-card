import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { Notification } from '../../../config/schema/actions/types.js';
import { localize } from '../../../localize/localize.js';
import { CardIssueManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import { IssueDescription } from '../types.js';
import { AbstractErrorIssue } from './abstract-error-issue.js';

declare module 'issue' {
  interface IssueTriggerContext {
    media_query: { error: unknown };
  }
}

export class MediaQueryIssue extends AbstractErrorIssue {
  public readonly key = 'media_query' as const;

  private _api: CardIssueManagerAPI;

  constructor(api: CardIssueManagerAPI) {
    super();
    this._api = api;
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
