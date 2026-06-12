import PQueue from 'p-queue';

type UnsubscribeFn = () => Promise<void>;
type SubscribeFn = () => Promise<UnsubscribeFn>;

/**
 * Manages subscriptions keyed by `K`: the first subscriber for a key invokes
 * `subscribeFn` to establish the underlying connection, subsequent subscribers
 * for the same key piggyback on it, and the last to unsubscribe tears it down.
 *
 * Operations for a given key run through a single-concurrency queue, so
 * subscribe and unsubscribe cannot interleave for the same key -- no race
 * windows by construction. This aims to a leak-proof reusable subscription
 * manager.
 */
export class KeyedSubscriptionManager<K, R> {
  private _requests: R[] = [];
  private _unsubscribers = new Map<K, UnsubscribeFn>();
  private _queues = new Map<K, PQueue>();
  private _getKeyFn: (request: R) => K;

  constructor(getKeyFn: (request: R) => K) {
    this._getKeyFn = getKeyFn;
  }

  public async subscribe(request: R, subscribeFn: SubscribeFn): Promise<void> {
    const key = this._getKeyFn(request);
    await this._queueFor(key).add(async () => {
      this._requests.push(request);
      if (!this._unsubscribers.has(key)) {
        const unsubscribe = await subscribeFn();
        this._unsubscribers.set(key, unsubscribe);
      }
    });
  }

  public async unsubscribe(request: R): Promise<void> {
    const key = this._getKeyFn(request);
    await this._queueFor(key).add(async () => {
      this._requests = this._requests.filter((r) => r !== request);
      if (!this._hasSubscribers(key)) {
        const unsubscribe = this._unsubscribers.get(key);
        this._unsubscribers.delete(key);
        await unsubscribe?.();
      }
    });
  }

  public getRequestsForKey(key: K): readonly R[] {
    return this._requests.filter((r) => this._getKeyFn(r) === key);
  }

  private _queueFor(key: K): PQueue {
    let queue = this._queues.get(key);
    if (!queue) {
      queue = new PQueue({ concurrency: 1 });
      this._queues.set(key, queue);
    }
    return queue;
  }

  private _hasSubscribers(key: K): boolean {
    return this._requests.some((r) => this._getKeyFn(r) === key);
  }
}
