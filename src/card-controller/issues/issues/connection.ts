import type { ConditionState } from '../../../condition-trigger/conditions/types.js';
import { localize } from '../../../localize/localize.js';
import type { HASSReadiness } from '../../hass/types.js';
import type { Issue, IssueDescription } from '../types.js';

export class ConnectionIssue implements Issue {
  public readonly key = 'connection' as const;

  private _readiness: HASSReadiness = 'ready';

  public detectDynamic(state: ConditionState): void {
    if (state.hassReadiness) {
      this._readiness = state.hassReadiness;
    }
  }

  public hasIssue(): boolean {
    return this._readiness !== 'ready';
  }

  public isFullCardIssue(): boolean {
    return true;
  }

  public getIssue(): IssueDescription | null {
    return this._readiness === 'disconnected'
      ? {
          icon: 'mdi:lan-disconnect',
          severity: 'high',
          notification: {
            heading: {
              text: localize('issues.connection.lost.heading'),
              icon: 'mdi:lan-disconnect',
              severity: 'high',
            },
            body: { text: localize('issues.connection.lost.text') },
            in_progress: true,
          },
        }
      : this._readiness === 'starting'
        ? {
            icon: 'mdi:home-assistant',
            severity: 'medium',
            notification: {
              heading: {
                text: localize('issues.connection.starting.heading'),
                icon: 'mdi:home-assistant',
                severity: 'medium',
              },
              body: { text: localize('issues.connection.starting.text') },
              in_progress: true,
            },
          }
        : null;
  }

  public reset(): void {
    this._readiness = 'ready';
  }
}
