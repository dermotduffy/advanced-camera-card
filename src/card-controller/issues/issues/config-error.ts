import type { IssueTriggerContext } from 'issue';
import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import { Issue, IssueDescription } from '../types.js';

declare module 'issue' {
  interface IssueTriggerContext {
    config_error: { error: unknown };
  }
}

export class ConfigErrorIssue implements Issue {
  public readonly key = 'config_error' as const;

  private _error: unknown = null;

  public trigger(context: IssueTriggerContext['config_error']): void {
    this._error = context.error;
  }

  public hasIssue(): boolean {
    return this._error !== null;
  }

  public isFullCardIssue(): boolean {
    return true;
  }

  public getIssue(): IssueDescription | null {
    if (this._error === null) {
      return null;
    }
    // this._error is non-null (guarded above), so the factory always returns
    // a Notification here.
    const notification = createNotificationFromError(this._error, {
      heading: { text: localize('issues.config_error.heading') },
    });
    /* istanbul ignore next: this._error is non-null -- @preserve */
    if (!notification) {
      return null;
    }
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification,
    };
  }

  public reset(): void {
    this._error = null;
  }
}
