import { describe, expect, it, vi } from 'vitest';

import { EventSubscriptionIssue } from '../../../../src/card-controller/issues/issues/event-subscription';
import { Issue } from '../../../../src/card-controller/issues/types';
import { SubscriptionFailure } from '../../../../src/ha/connection/subscription-health-monitor';
import { localize } from '../../../../src/localize/localize';
import { createSubscriptionHealth } from '../../test-utils';

const createSubscriptionFailure = (key: string): SubscriptionFailure<string> => ({
  key,
  error: new Error(key),
  failureCount: 1,
});

describe('EventSubscriptionIssue', () => {
  it('should register the change callback as a health listener', () => {
    const health = createSubscriptionHealth();
    const changeCallback = vi.fn();

    new EventSubscriptionIssue(health, changeCallback);

    expect(health.addListener).toBeCalledWith(changeCallback);
  });

  it('should have no issue when there are no failures', () => {
    const health = createSubscriptionHealth();
    const issue = new EventSubscriptionIssue(health, vi.fn());

    expect(issue.hasIssue()).toBe(false);
    expect(issue.getIssue()).toBeNull();
    expect(issue.getNotification()).toBeNull();
  });

  it('should describe the failing event types sorted, at medium severity', () => {
    const health = createSubscriptionHealth();
    health.getFailures.mockReturnValue([
      createSubscriptionFailure('zebra_event'),
      createSubscriptionFailure('alpha_event'),
    ]);
    const issue = new EventSubscriptionIssue(health, vi.fn());

    expect(issue.hasIssue()).toBe(true);

    const description = issue.getIssue();
    expect(description?.severity).toBe('medium');
    expect(description?.notification.heading?.text).toBe(
      localize('issues.event_subscription.heading'),
    );
    expect(description?.notification.metadata?.map((detail) => detail.text)).toEqual([
      'alpha_event',
      'zebra_event',
    ]);
  });

  it('should offer a retry control on the notification', () => {
    const health = createSubscriptionHealth();
    health.getFailures.mockReturnValue([createSubscriptionFailure('zha_event')]);
    const issue = new EventSubscriptionIssue(health, vi.fn());

    expect(issue.getNotification()?.controls?.[0].icon).toBe('mdi:refresh');
  });

  it('should re-drive the failing subscriptions on retry', () => {
    const health = createSubscriptionHealth();
    const issue = new EventSubscriptionIssue(health, vi.fn());

    expect(issue.retry()).toBe(true);
    expect(health.retry).toBeCalledTimes(1);
  });

  it('should not opt into IssueManager-scheduled retries', () => {
    // No `needsRetry()` means the subscription manager stays the sole auto-retry
    // loop; the IssueManager never schedules this issue.
    const issue: Issue = new EventSubscriptionIssue(createSubscriptionHealth(), vi.fn());

    expect(issue.needsRetry).toBeUndefined();
  });

  it('should remove its health listener on destroy', () => {
    const health = createSubscriptionHealth();
    const unsubscribe = vi.fn();
    health.addListener.mockReturnValue(unsubscribe);
    const issue = new EventSubscriptionIssue(health, vi.fn());

    issue.destroy();

    expect(unsubscribe).toBeCalledTimes(1);
  });
});
