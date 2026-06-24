import type { RecoverableHealthInterface, UnlistenCallback } from '../../health';
import type { HASSWebSocketSubscriptionStatus } from './subscription-manager';

// One keyed subscription that is currently failing, with the most recent
// rejection reason and attempt count.
export interface SubscriptionFailure<K> {
  key: K;
  error: unknown;
  failureCount?: number;
}

// Recoverable health of a set of keyed subscriptions. A named specialisation
// for readability and the extension point for any subscription-specific health
// surface later.
export type SubscriptionHealthInterface<K> = RecoverableHealthInterface<
  SubscriptionFailure<K>
>;

/**
 * Aggregates the per-request status stream of a
 * `HASSConnectionSubscriptionManager` into per-key health: which keys are
 * currently failing, observable for changes, and retriable on demand. Generic
 * over the manager's key/request types so any consumer can reuse it; it never
 * knows how failures are surfaced (issue, log, nothing).
 */
export class SubscriptionHealthMonitor<K, R> implements SubscriptionHealthInterface<K> {
  // The latest significant (`subscribed`/`failing`) status per request.
  private _health = new Map<R, HASSWebSocketSubscriptionStatus<K, R>>();
  private _listeners = new Set<() => void>();

  private _retry: (request: R) => void;

  constructor(retry: (request: R) => void) {
    this._retry = retry;
  }

  public update(status: HASSWebSocketSubscriptionStatus<K, R>): void {
    // `waiting` is emitted before every retry attempt; treating it as
    // significant would flap a failing request back to healthy mid-backoff.
    if (status.state === 'waiting') {
      return;
    }

    const wasFailing = this._failingKeys().has(status.key);
    switch (status.state) {
      case 'subscribed':
      case 'failing':
        // Retain the status as-is; only these two are significant.
        this._health.set(status.request, status);
        break;
      case 'unsubscribed':
        this._health.delete(status.request);
        break;
    }

    // A single status changes at most one key's failing state, so notifying on
    // that key's transition keeps observers off the manager's per-retry churn.
    if (this._failingKeys().has(status.key) !== wasFailing) {
      for (const listener of this._listeners) {
        listener();
      }
    }
  }

  public getFailures(): SubscriptionFailure<K>[] {
    const failing = new Map<K, SubscriptionFailure<K>>();
    for (const status of this._health.values()) {
      if (status.state === 'failing' && !failing.has(status.key)) {
        failing.set(status.key, {
          key: status.key,
          error: status.error,
          failureCount: status.failureCount,
        });
      }
    }
    return [...failing.values()];
  }

  public addListener(listener: () => void): UnlistenCallback {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  // Re-drive one currently-`failing` request per failing key; one suffices
  // since the WS subscription is keyed.
  public retry(): void {
    const retried = new Set<K>();
    for (const [request, status] of this._health) {
      if (status.state === 'failing' && !retried.has(status.key)) {
        retried.add(status.key);
        this._retry(request);
      }
    }
  }

  private _failingKeys(): Set<K> {
    return new Set(this.getFailures().map((failure) => failure.key));
  }
}
