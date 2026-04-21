import type { IssueTriggerContext } from 'issue';
import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import { CardIssueManagerAPI } from '../../types';
import { createRetryControl } from '../retry-control.js';
import { Issue, IssueDescription } from '../types';

declare module 'issue' {
  interface IssueTriggerContext {
    initialization: { error: unknown };
  }
}

export class InitializationIssue implements Issue {
  public readonly key = 'initialization' as const;

  private _api: CardIssueManagerAPI;
  private _error: unknown = null;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  public trigger(context: IssueTriggerContext['initialization']): void {
    this._error = context.error;
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
    this._api.getCameraManager().destroy();
    return false;
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

    const notification = createNotificationFromError(this._error, {
      heading: { text: localize('issues.initialization.heading') },
    });
    /* istanbul ignore next: this._error is non-null -- @preserve */
    if (!notification) {
      return null;
    }
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: {
        ...notification,
        controls: [createRetryControl(this.key)],
      },
    };
  }

  public reset(): void {
    this._error = null;
  }
}
