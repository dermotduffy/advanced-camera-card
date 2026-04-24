import { STATE_RUNNING } from 'home-assistant-js-websocket';
import { ConditionState } from '../../../conditions/types.js';
import { localize } from '../../../localize/localize.js';
import { Issue, IssueDescription } from '../types.js';

// Tracks "is HA fully ready to talk to". Active in two sub-states:
//   - 'lost'     : the WebSocket is disconnected
//   - 'starting' : the WebSocket is connected but HA hasn't finished loading
//                  integrations yet (hass.config.state !== STATE_RUNNING)
// Both sub-states render as a full-card notification with a spinner. The card
// only attempts re-initialization when the issue clears (i.e. HA is fully
// ready), so integration-specific WS calls (e.g. Frigate event subscriptions)
// don't fail with "Unknown command" against a half-loaded HA.
type ConnectionState = 'ready' | 'lost' | 'starting';

export class ConnectionIssue implements Issue {
  public readonly key = 'connection' as const;

  private _state: ConnectionState = 'ready';

  public detectDynamic(state: ConditionState): void {
    // Before HASS is ever provided, leave state untouched — undefined hass is
    // not a disconnection, just "not yet initialized".
    if (state.hass === undefined) {
      return;
    }
    if (!state.hass.connected) {
      this._state = 'lost';
    } else if (state.hass.config?.state !== STATE_RUNNING) {
      this._state = 'starting';
    } else {
      this._state = 'ready';
    }
  }

  public hasIssue(): boolean {
    return this._state !== 'ready';
  }

  public isFullCardIssue(): boolean {
    return true;
  }

  public getIssue(): IssueDescription | null {
    return this._state === 'lost'
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
      : this._state === 'starting'
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
    this._state = 'ready';
  }
}
