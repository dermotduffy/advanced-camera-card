import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import { IssueDescription } from '../types.js';
import { AbstractErrorIssue } from './abstract-error-issue.js';

declare module 'issue' {
  interface IssueTriggerContext {
    config_error: { error: unknown };
  }
}

export class ConfigErrorIssue extends AbstractErrorIssue {
  public readonly key = 'config_error' as const;

  public isFullCardIssue(): boolean {
    return true;
  }

  protected _buildDescription(error: NonNullable<unknown>): IssueDescription {
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: createNotificationFromError(error, {
        heading: { text: localize('issues.config_error.heading') },
      }),
    };
  }
}
