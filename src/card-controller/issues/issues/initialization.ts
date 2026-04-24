import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import { CardIssueManagerAPI } from '../../types';
import { createRetryControl } from '../retry-control.js';
import { IssueDescription } from '../types';
import { AbstractErrorIssue } from './abstract-error-issue.js';

declare module 'issue' {
  interface IssueTriggerContext {
    initialization: { error: unknown };
  }
}

export class InitializationIssue extends AbstractErrorIssue {
  public readonly key = 'initialization' as const;

  private _api: CardIssueManagerAPI;

  constructor(api: CardIssueManagerAPI) {
    super();
    this._api = api;
  }

  public detectDynamic(): void {
    if (
      this._error !== null &&
      this._api.getInitializationManager().isInitializedMandatory()
    ) {
      this._error = null;
    }
  }

  public needsRetry(): boolean {
    return this._error !== null;
  }

  public retry(): boolean {
    // Clear the error so the full-card issue is removed and shouldUpdate()
    // no longer short-circuits before initializeMandatory().
    this._error = null;

    // Reset init state so initializeMandatory() re-attempts on the next
    // render cycle.
    this._api.getInitializationManager().uninitializeMandatory();
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
