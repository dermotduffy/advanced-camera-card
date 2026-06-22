import { describe, expect, it, vi } from 'vitest';
import { SubscriptionHealthMonitor } from '../../../src/ha/connection/subscription-health-monitor';
import { HASSWebSocketSubscriptionStatus } from '../../../src/ha/connection/subscription-manager';

interface TestRequest {
  id: string;
}

type State = HASSWebSocketSubscriptionStatus<string, TestRequest>['state'];

const status = (
  state: State,
  request: TestRequest,
  key: string,
  extra?: { error?: unknown; failureCount?: number },
): HASSWebSocketSubscriptionStatus<string, TestRequest> => ({
  state,
  request,
  key,
  ...extra,
});

describe('SubscriptionHealthMonitor', () => {
  it('should report a failing key with its error and failure count', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const error = new Error('boom');

    monitor.update(
      status('failing', { id: 'a' }, 'zha_event', { error, failureCount: 2 }),
    );

    expect(monitor.getFailures()).toEqual([
      { key: 'zha_event', error, failureCount: 2 },
    ]);
  });

  it('should ignore waiting so it never clears a failing key', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const request = { id: 'a' };

    monitor.update(status('failing', request, 'zha_event', { failureCount: 1 }));
    monitor.update(status('waiting', request, 'zha_event'));

    expect(monitor.getFailures().map((f) => f.key)).toEqual(['zha_event']);
  });

  it('should clear a key once it subscribes', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const request = { id: 'a' };

    monitor.update(status('failing', request, 'zha_event', { failureCount: 1 }));
    monitor.update(status('subscribed', request, 'zha_event'));

    expect(monitor.getFailures()).toEqual([]);
  });

  it('should clear a key once its request unsubscribes', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const request = { id: 'a' };

    monitor.update(status('failing', request, 'zha_event', { failureCount: 1 }));
    monitor.update(status('unsubscribed', request, 'zha_event'));

    expect(monitor.getFailures()).toEqual([]);
  });

  it('should report each failing key once regardless of subscriber count', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());

    monitor.update(status('failing', { id: 'a' }, 'zha_event', { failureCount: 1 }));
    monitor.update(status('failing', { id: 'b' }, 'zha_event', { failureCount: 1 }));

    expect(monitor.getFailures().map((f) => f.key)).toEqual(['zha_event']);
  });

  it('should notify listeners only when a key changes failing state', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const listener = vi.fn();
    monitor.addListener(listener);
    const request = { id: 'a' };

    // Healthy -> failing: one notification.
    monitor.update(status('failing', request, 'zha_event', { failureCount: 1 }));
    expect(listener).toBeCalledTimes(1);

    // Still failing (next attempt, same key): no membership change, no notify.
    monitor.update(status('failing', request, 'zha_event', { failureCount: 2 }));
    expect(listener).toBeCalledTimes(1);

    // Failing -> healthy: one more notification.
    monitor.update(status('subscribed', request, 'zha_event'));
    expect(listener).toBeCalledTimes(2);
  });

  it('should stop notifying after the returned unsubscribe is called', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const listener = vi.fn();
    const remove = monitor.addListener(listener);

    remove();
    monitor.update(status('failing', { id: 'a' }, 'zha_event', { failureCount: 1 }));

    expect(listener).not.toBeCalled();
  });

  it('should retry one request per failing key and leave healthy keys alone', () => {
    const retry = vi.fn();
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(retry);
    const failingA = { id: 'a' };
    const failingB = { id: 'b' };
    const healthy = { id: 'c' };

    // Two requests on a failing key, plus a separate healthy key.
    monitor.update(status('failing', failingA, 'zha_event', { failureCount: 1 }));
    monitor.update(status('failing', failingB, 'zha_event', { failureCount: 1 }));
    monitor.update(status('subscribed', healthy, 'deconz_event'));

    monitor.retry();

    // Exactly one retry, for one of the failing key's requests; never the
    // healthy key.
    expect(retry).toBeCalledTimes(1);
    expect([failingA, failingB]).toContainEqual(retry.mock.calls[0][0]);
  });

  it('should retry the failing request even when a subscribed sibling is stored first', () => {
    const retry = vi.fn();
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(retry);
    const subscribed = { id: 'a' };
    const failing = { id: 'b' };

    // Subscribed sibling recorded before the failing one on the same key.
    monitor.update(status('subscribed', subscribed, 'zha_event'));
    monitor.update(status('failing', failing, 'zha_event', { failureCount: 1 }));

    monitor.retry();

    expect(retry).toBeCalledTimes(1);
    expect(retry).toBeCalledWith(failing);
  });

  it('should retry one request for each distinct failing key', () => {
    const retry = vi.fn();
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(retry);
    const a = { id: 'a' };
    const b = { id: 'b' };

    monitor.update(status('failing', a, 'zha_event', { failureCount: 1 }));
    monitor.update(status('failing', b, 'deconz_event', { failureCount: 1 }));

    monitor.retry();

    expect(retry).toBeCalledTimes(2);
    expect(retry.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([a, b]));
  });

  it('should not notify when a never-failed request unsubscribes', () => {
    const monitor = new SubscriptionHealthMonitor<string, TestRequest>(vi.fn());
    const listener = vi.fn();
    monitor.addListener(listener);

    monitor.update(status('unsubscribed', { id: 'a' }, 'zha_event'));

    expect(listener).not.toBeCalled();
    expect(monitor.getFailures()).toEqual([]);
  });
});
