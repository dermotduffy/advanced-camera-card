import { createNotificationFromText } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import { getContextFromError } from '../../../utils/error-context.js';
import { CardIssueManagerAPI } from '../../types.js';
import { IssueDescription } from '../types.js';
import { AbstractErrorIssue } from './abstract-error-issue.js';

declare module 'issue' {
  interface IssueTriggerContext {
    view_incompatible: { error: unknown };
  }
}

export class ViewIncompatibleIssue extends AbstractErrorIssue {
  public readonly key = 'view_incompatible' as const;

  private _api: CardIssueManagerAPI;

  constructor(api: CardIssueManagerAPI) {
    super();
    this._api = api;
  }

  // Full-card when no view is available to anchor a popup to (initial load
  // with an unrealizable default view); popup when an existing view remains
  // visible underneath (mid-session user action that can't resolve).
  public isFullCardIssue(): boolean {
    return !this._api.getViewManager().getView();
  }

  protected _buildDescription(error: NonNullable<unknown>): IssueDescription {
    return {
      icon: 'mdi:video-off',
      severity: 'high',
      notification: createNotificationFromText(
        localize('issues.view_incompatible.text'),
        {
          heading: {
            text: localize('issues.view_incompatible.heading'),
            icon: 'mdi:video-off',
            severity: 'high',
          },
          context: getContextFromError(error) ?? undefined,
        },
      ),
    };
  }
}
