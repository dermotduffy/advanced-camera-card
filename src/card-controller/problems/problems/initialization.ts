import type { ProblemTriggerContext } from 'problem';
import { createNotificationFromError } from '../../../components-lib/notification/factory.js';
import { CardProblemManagerAPI } from '../../types';
import { createRetryControl } from '../retry-control.js';
import { Problem, ProblemDescription } from '../types';

declare module 'problem' {
  interface ProblemTriggerContext {
    initialization: { error: unknown };
  }
}

export class InitializationProblem implements Problem {
  public readonly key = 'initialization' as const;

  private _api: CardProblemManagerAPI;
  private _error: unknown = null;

  constructor(api: CardProblemManagerAPI) {
    this._api = api;
  }

  public trigger(context: ProblemTriggerContext['initialization']): void {
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
    // Clear the error so the full-card problem is removed and
    // shouldUpdate() no longer short-circuits before initializeMandatory().
    this._error = null;

    // Reset init state so _initializeMandatory() re-attempts on the next render
    // cycle.
    this._api.getInitializationManager().uninitializeMandatory();
    this._api.getCameraManager().destroy();
    return false;
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

    const notification = createNotificationFromError(this._error);
    /* istanbul ignore next: this._error is non-null -- @preserve */
    if (!notification) {
      return null;
    }
    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: {
        ...notification,
        in_progress: true,
        controls: [createRetryControl(this.key)],
      },
    };
  }

  public reset(): void {
    this._error = null;
  }
}
