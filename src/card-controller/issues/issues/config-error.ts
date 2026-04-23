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

  private _error: NonNullable<unknown> | null = null;

  public trigger(context: IssueTriggerContext['config_error']): void {
    this._error = context.error ?? null;
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
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: createNotificationFromError(this._error, {
        heading: { text: localize('issues.config_error.heading') },
      }),
    };
  }

  public reset(): void {
    this._error = null;
  }
}
