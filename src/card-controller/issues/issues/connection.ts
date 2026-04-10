import { ConditionState } from '../../../conditions/types.js';
import { localize } from '../../../localize/localize.js';
import { Issue, IssueDescription } from '../types.js';

export class ConnectionIssue implements Issue {
  public readonly key = 'connection' as const;

  private _connectionLost = false;

  public detectDynamic(state: ConditionState): void {
    // Only detect disconnection when HASS has been set (state.hass exists).
    // Before HASS is ever provided, state.hass is undefined — not a
    // disconnection.
    if (state.hass !== undefined) {
      this._connectionLost = !state.hass.connected;
    }
  }

  public hasIssue(): boolean {
    return this._connectionLost;
  }

  public isFullCardIssue(): boolean {
    return true;
  }

  public getIssue(): IssueDescription | null {
    if (!this._connectionLost) {
      return null;
    }
    return {
      icon: 'mdi:lan-disconnect',
      severity: 'high',
      notification: {
        heading: {
          text: localize('issues.connection.heading'),
          icon: 'mdi:lan-disconnect',
          severity: 'high',
        },
        body: { text: localize('issues.connection.text') },
        in_progress: true,
      },
    };
  }

  public reset(): void {
    this._connectionLost = false;
  }
}
