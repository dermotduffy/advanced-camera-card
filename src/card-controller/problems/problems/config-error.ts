import type { ProblemTriggerContext } from 'problem';
import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { localize } from '../../../localize/localize.js';
import { Problem, ProblemDescription } from '../types.js';

declare module 'problem' {
  interface ProblemTriggerContext {
    config_error: { error: unknown };
  }
}

export class ConfigErrorProblem implements Problem {
  public readonly key = 'config_error' as const;

  private _error: unknown = null;

  public trigger(context: ProblemTriggerContext['config_error']): void {
    this._error = context.error;
  }

  public hasProblem(): boolean {
    return this._error !== null;
  }

  public isFullCardProblem(): boolean {
    return true;
  }

  public getProblem(): ProblemDescription | null {
    if (this._error === null) {
      return null;
    }
    // this._error is non-null (guarded above), so the factory always returns
    // a Notification here.
    const notification = createNotificationFromError(this._error, {
      heading: { text: localize('problems.config_error.heading') },
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
