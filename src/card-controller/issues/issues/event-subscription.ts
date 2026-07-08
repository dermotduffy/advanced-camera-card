import type { Notification } from '../../../config/schema/actions/types';
import type { SubscriptionHealthInterface } from '../../../ha/connection/subscription-health-monitor';
import { localize } from '../../../localize/localize';
import type { UnsubscribeCallback } from '../../../types';
import { createRetryControl } from '../retry-control';
import type { Issue, IssueDescription } from '../types';

const ISSUE_ICON = 'mdi:lan-disconnect';

/**
 * Surfaces persistent HA event-subscription failures (from the EventWatcher's
 * health monitor) as a non-full-card notification listing the failing event
 * types. Self-detects by observing the health monitor and asking the
 * IssueManager to re-evaluate on change.
 *
 * Detection scope: the transport reports `failing` only when a subscribe
 * attempt rejects (initial subscribe, era replay, or retry) -- there is no
 * heartbeat on an established subscription, so this catches subscribe-time
 * failures, not a subscription that goes silently dead after subscribing.
 *
 * Recovery is the subscription manager's own forever-retry loop, so this issue
 * does NOT implement `needsRetry()` (no IssueManager-scheduled retry that would
 * race the transport loop). The notification's Retry button is user-forced
 * only: it re-drives the failing subscriptions immediately via the monitor.
 */
export class EventSubscriptionIssue implements Issue {
  public readonly key = 'event_subscription' as const;

  private _health: SubscriptionHealthInterface<string>;
  private _unsubscribe: UnsubscribeCallback;

  constructor(health: SubscriptionHealthInterface<string>, changeCallback: () => void) {
    this._health = health;
    this._unsubscribe = health.addListener(changeCallback);
  }

  public hasIssue(): boolean {
    return this._health.getFailures().length > 0;
  }

  public getIssue(): IssueDescription | null {
    if (!this.hasIssue()) {
      return null;
    }
    return {
      icon: ISSUE_ICON,
      severity: 'medium',
      notification: this._buildNotification(),
    };
  }

  public getNotification(): Notification | null {
    return this.getIssue()?.notification ?? null;
  }

  public retry(): boolean {
    this._health.retry();
    return true;
  }

  public destroy(): void {
    this._unsubscribe();
  }

  private _buildNotification(): Notification {
    const eventTypes = this._health
      .getFailures()
      .map((failure) => failure.key)
      .sort();
    return {
      heading: {
        text: localize('issues.event_subscription.heading'),
        icon: ISSUE_ICON,
        severity: 'medium',
      },
      body: { text: localize('issues.event_subscription.text') },
      metadata: eventTypes.map((eventType) => ({ text: eventType })),
      controls: [createRetryControl(this.key)],
    };
  }
}
