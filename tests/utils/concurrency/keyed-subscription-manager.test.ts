import { describe, expect, it, vi } from 'vitest';

import { KeyedSubscriptionManager } from '../../../src/utils/concurrency/keyed-subscription-manager';

interface TestRequest {
  key: string;
  callback: () => void;
}

const create = (): KeyedSubscriptionManager<string, TestRequest> =>
  new KeyedSubscriptionManager<string, TestRequest>((r) => r.key);

describe('KeyedSubscriptionManager', () => {
  it('should open the subscription once per key regardless of subscriber count', async () => {
    const manager = create();
    const subscribeFn = vi.fn().mockResolvedValue(vi.fn());

    await manager.subscribe({ key: 'a', callback: vi.fn() }, subscribeFn);
    await manager.subscribe({ key: 'a', callback: vi.fn() }, subscribeFn);

    expect(subscribeFn).toHaveBeenCalledTimes(1);
  });

  it('should open a separate subscription for each distinct key', async () => {
    const manager = create();
    const subscribeFn = vi.fn().mockResolvedValue(vi.fn());

    await manager.subscribe({ key: 'a', callback: vi.fn() }, subscribeFn);
    await manager.subscribe({ key: 'b', callback: vi.fn() }, subscribeFn);

    expect(subscribeFn).toHaveBeenCalledTimes(2);
  });

  it('should tear down the subscription only when the last subscriber for a key unsubscribes', async () => {
    const manager = create();
    const unsub = vi.fn();
    const subscribeFn = vi.fn().mockResolvedValue(unsub);

    const req1 = { key: 'a', callback: vi.fn() };
    const req2 = { key: 'a', callback: vi.fn() };
    await manager.subscribe(req1, subscribeFn);
    await manager.subscribe(req2, subscribeFn);

    await manager.unsubscribe(req1);
    expect(unsub).not.toHaveBeenCalled();

    await manager.unsubscribe(req2);
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('should await a pending subscribe before tearing down when unsubscribed mid-flight', async () => {
    const manager = create();
    const unsub = vi.fn();

    let resolveOpen: ((cb: () => Promise<void>) => void) | undefined;
    const openPromise = new Promise<() => Promise<void>>((resolve) => {
      resolveOpen = resolve;
    });
    const subscribeFn = vi.fn().mockReturnValue(openPromise);

    const req = { key: 'a', callback: vi.fn() };
    const subscribePromise = manager.subscribe(req, subscribeFn);
    const unsubscribePromise = manager.unsubscribe(req);

    resolveOpen?.(unsub);
    await subscribePromise;
    await unsubscribePromise;

    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('should expose the requests matching a given key', async () => {
    const manager = create();
    const subscribeFn = vi.fn().mockResolvedValue(vi.fn());

    const reqA1 = { key: 'a', callback: vi.fn() };
    const reqA2 = { key: 'a', callback: vi.fn() };
    const reqB = { key: 'b', callback: vi.fn() };
    await manager.subscribe(reqA1, subscribeFn);
    await manager.subscribe(reqA2, subscribeFn);
    await manager.subscribe(reqB, subscribeFn);

    expect(manager.getRequestsForKey('a')).toEqual([reqA1, reqA2]);
    expect(manager.getRequestsForKey('b')).toEqual([reqB]);

    await manager.unsubscribe(reqA1);
    expect(manager.getRequestsForKey('a')).toEqual([reqA2]);
  });

  it('should roll back the request when the underlying subscribeFn rejects', async () => {
    const manager = create();
    const subscribeFn = vi.fn().mockRejectedValue(new Error('ws-fail'));

    const req = { key: 'a', callback: vi.fn() };
    await expect(manager.subscribe(req, subscribeFn)).rejects.toThrow('ws-fail');

    // The failed subscriber must not be left dispatching against a
    // never-established connection.
    expect(manager.getRequestsForKey('a')).toEqual([]);

    // A subsequent successful subscribe should re-attempt the underlying call.
    const successFn = vi.fn().mockResolvedValue(vi.fn());
    await manager.subscribe(req, successFn);
    expect(successFn).toHaveBeenCalledTimes(1);
    expect(manager.getRequestsForKey('a')).toEqual([req]);
  });

  it('should treat unsubscribe of an unknown request as a no-op', async () => {
    const manager = create();
    const unsub = vi.fn();
    const subscribeFn = vi.fn().mockResolvedValue(unsub);

    const subscribed = { key: 'a', callback: vi.fn() };
    await manager.subscribe(subscribed, subscribeFn);

    await manager.unsubscribe({ key: 'a', callback: vi.fn() });

    expect(unsub).not.toHaveBeenCalled();
    expect(manager.getRequestsForKey('a')).toEqual([subscribed]);
  });
});
