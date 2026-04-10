import type { ProblemTriggerContext } from 'problem';
import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { Notification } from '../../../config/schema/actions/types.js';
import { localize } from '../../../localize/localize.js';
import { CardProblemManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import { Problem, ProblemDescription } from '../types.js';

declare module 'problem' {
  interface ProblemTriggerContext {
    media_query: { error: unknown };
  }
}

export class MediaQueryProblem implements Problem {
  public readonly key = 'media_query' as const;

  private _api: CardProblemManagerAPI;
  private _error: unknown = null;

  constructor(api: CardProblemManagerAPI) {
    this._api = api;
  }

  public trigger(context: ProblemTriggerContext['media_query']): void {
    this._error = context.error;
  }

  public hasProblem(): boolean {
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

    // Exclusive retry. No other problem should attempt to retry until the next
    // evaluation cycle, when we'll know if this was successful.
    return true;
  }

  public getNotification(): Notification | null {
    if (this._error === null) {
      return null;
    }
    const notification = createNotificationFromError(this._error, {
      heading: { text: localize('problems.media_query.heading') },
    });
    /* istanbul ignore next: this._error is non-null -- @preserve */
    if (!notification) {
      return null;
    }
    return {
      ...notification,
      controls: [createRetryControl(this.key)],
    };
  }

  public getProblem(): ProblemDescription | null {
    const notification = this.getNotification();
    return notification !== null
      ? { icon: 'mdi:alert', severity: 'high', notification }
      : null;
  }

  public reset(): void {
    this._error = null;
  }
}
