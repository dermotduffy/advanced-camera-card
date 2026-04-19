import type { IssueTriggerContext } from 'issue';
import { dataToContext } from '../../../components-lib/notification/data-to-context.js';
import { localize } from '../../../localize/localize.js';
import { getContextFromError } from '../../../utils/error-context.js';
import { CardIssueManagerAPI } from '../../types.js';
import { Issue, IssueDescription } from '../types.js';

declare module 'issue' {
  interface IssueTriggerContext {
    view_incompatible: { error: unknown };
  }
}

export class ViewIncompatibleIssue implements Issue {
  public readonly key = 'view_incompatible' as const;

  private _api: CardIssueManagerAPI;
  private _error: unknown = null;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  public trigger(context: IssueTriggerContext['view_incompatible']): void {
    this._error = context.error;
  }

  public hasIssue(): boolean {
    return this._error !== null;
  }

  // Full-card when no view is available to anchor a popup to (initial load
  // with an unrealizable default view); popup when an existing view remains
  // visible underneath (mid-session user action that can't resolve).
  public isFullCardIssue(): boolean {
    return !this._api.getViewManager().getView();
  }

  public getIssue(): IssueDescription | null {
    if (this._error === null) {
      return null;
    }

    const context = getContextFromError(this._error);

    return {
      icon: 'mdi:video-off',
      severity: 'high',
      notification: {
        heading: {
          text: localize('issues.view_incompatible.heading'),
          icon: 'mdi:video-off',
          severity: 'high',
        },
        body: { text: localize('issues.view_incompatible.text') },
        ...(context && { context: dataToContext(context) }),
      },
    };
  }

  public reset(): void {
    this._error = null;
  }
}
