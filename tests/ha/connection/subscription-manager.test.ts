import { Connection, STATE_RUNNING, STATE_STARTING } from 'home-assistant-js-websocket';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  HASSConnectionSubscriptionManager,
  HASSWebSocketStatusCallback,
  HASSWebSocketSubscriptionStatus,
} from '../../../src/ha/connection/subscription-manager';
import {
  HASSWebSocketLiveness,
  HASSWebSocketOpenCallback,
} from '../../../src/ha/connection/types';
import { HASSSource } from '../../../src/ha/source';
import { createHASS, createHASSSource, flushPromises } from '../../test-utils';

interface TestRequest {
  key: string;
  label?: string;
}

interface CapturedOpenCall {
  request: TestRequest;
  connection: Connection;
  guard: HASSWebSocketLiveness;
  unsub: () => Promise<void>;
}

// Captures every open-callback invocation so tests can drive its dispatcher and
// observe the guard state.
const createRecordingOpenCallback = (): {
  openCallback: HASSWebSocketOpenCallback;
  calls: CapturedOpenCall[];
} => {
  const calls: CapturedOpenCall[] = [];
  const openCallback: HASSWebSocketOpenCallback = async (connection, guard) => {
    const unsub = vi.fn().mockResolvedValue(undefined);
    calls.push({ request: { key: 'unused' }, connection, guard, unsub });
    return unsub;
  };
  return { openCallback, calls };
};

// An open callback that always rejects, driving the retry/backoff machinery.
const createFailingOpenCallback = (): HASSWebSocketOpenCallback =>
  vi.fn().mockRejectedValue(new Error('boom'));

const createManager = (
  source: HASSSource,
): HASSConnectionSubscriptionManager<string, TestRequest> =>
  new HASSConnectionSubscriptionManager<string, TestRequest>((r) => r.key, source);

// Wires a source (seeded with `initial`) to a fresh manager, returning the
// source's drivers alongside it.
const setup = (initial: Parameters<typeof createHASSSource>[0] = createHASS()) => {
  const { source, push, getListenerCount } = createHASSSource(initial);
  return { manager: createManager(source), push, getListenerCount };
};

// A HASS on a brand-new connection, so pushing it forces an era swap.
const createSwappedHASS = (): ReturnType<typeof createHASS> => {
  const hass = createHASS();
  hass.connection = mock<Connection>();
  vi.mocked(hass.connection.subscribeEvents).mockResolvedValue(vi.fn());
  return hass;
};

// Fake timers plus pinned jitter, so backoff delays advance by exact durations.
const useDeterministicTimers = (): void => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(1);
};

// @vitest-environment jsdom
describe('HASSConnectionSubscriptionManager', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('attach lifecycle', () => {
    it('should not attach to source until first subscribe', () => {
      const { getListenerCount } = setup();
      expect(getListenerCount()).toBe(0);
    });

    it('should attach on first subscribe and detach on last unsubscribe', () => {
      const { manager, getListenerCount } = setup();
      const req = { key: 'a' };
      const { openCallback } = createRecordingOpenCallback();

      manager.subscribe(req, openCallback);
      expect(getListenerCount()).toBe(1);

      manager.unsubscribe(req);
      expect(getListenerCount()).toBe(0);
    });

    it('should bootstrap from source on first attach', async () => {
      const hass = createHASS();
      const { manager } = setup(hass);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();

      expect(calls).toHaveLength(1);
      expect(calls[0].connection).toBe(hass.connection);
    });

    it('should defer when source has no HASS yet', async () => {
      const { manager, push } = setup(null);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(calls).toHaveLength(0);

      push(createHASS());
      await flushPromises();
      expect(calls).toHaveLength(1);
    });

    it('should defer when initial HASS is not ready', async () => {
      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      const { manager, push } = setup(notReady);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(calls).toHaveLength(0);

      const ready = createHASS();
      ready.config.state = STATE_RUNNING;
      push(ready);
      await flushPromises();
      expect(calls).toHaveLength(1);
    });
  });

  describe('era transitions', () => {
    it('should replace KSM on connection swap and re-submit requests', async () => {
      const hass1 = createHASS();
      const { manager, push } = setup(hass1);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(calls).toHaveLength(1);
      expect(calls[0].connection).toBe(hass1.connection);

      const hass2 = createSwappedHASS();
      push(hass2);
      await flushPromises();

      expect(calls).toHaveLength(2);
      expect(calls[1].connection).toBe(hass2.connection);
    });

    it('should flip old-era guards to dead on swap', async () => {
      const { manager, push } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      const era1Guard = calls[0].guard;
      expect(era1Guard.isConnected()).toBe(true);

      push(createSwappedHASS());
      await flushPromises();

      expect(era1Guard.isConnected()).toBe(false);
      expect(calls[1].guard.isConnected()).toBe(true);
    });

    it('should close old-era subscriptions on a connection swap', async () => {
      const { manager, push } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(calls).toHaveLength(1);

      push(createSwappedHASS());
      await flushPromises();

      // The old era's subscription is closed, not abandoned.
      expect(calls[0].unsub).toBeCalledTimes(1);
    });

    it('should close old-era subscriptions when HA goes not-ready', async () => {
      const ready = createHASS();
      const { manager, push } = setup(ready);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();

      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      notReady.connection = ready.connection;
      push(notReady);
      await flushPromises();

      expect(calls[0].unsub).toBeCalledTimes(1);
    });

    it('should mint a fresh era when reanimating from a dead not-ready era, even with the same Connection', async () => {
      const ready = createHASS();
      const { manager, push } = setup(ready);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      const oldGuard = calls[0].guard;
      expect(oldGuard.isConnected()).toBe(true);

      // Go not-ready, keeping the same connection identity.
      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      notReady.connection = ready.connection;
      push(notReady);
      expect(oldGuard.isConnected()).toBe(false);

      // Re-ready with the SAME Connection: a fresh era must be minted so old
      // guards stay dead.
      push(ready);
      await flushPromises();

      expect(oldGuard.isConnected()).toBe(false);
      expect(calls).toHaveLength(2);
      expect(calls[1].guard.isConnected()).toBe(true);
    });

    it('should not replace KSM on a same-connection HASS push', async () => {
      const hass = createHASS();
      const { manager, push } = setup(hass);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(calls).toHaveLength(1);

      push(hass);
      push(hass);
      await flushPromises();

      // No retry triggered because nothing failed; same era.
      expect(calls).toHaveLength(1);
    });

    it('should drop the live era on not-ready and re-establish on the next ready push', async () => {
      const ready = createHASS();
      const { manager, push } = setup(ready);
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(calls).toHaveLength(1);

      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      push(notReady);

      // Old guard should be dead.
      expect(calls[0].guard.isConnected()).toBe(false);

      push(ready);
      await flushPromises();

      // Fresh era, fresh submit.
      expect(calls).toHaveLength(2);
    });
  });

  describe('dispatch', () => {
    it('should return current subscribers from getRequestsForKey synchronously', () => {
      const { manager } = setup();
      const { openCallback } = createRecordingOpenCallback();
      const r1 = { key: 'a', label: 'r1' };
      const r2 = { key: 'a', label: 'r2' };
      const r3 = { key: 'b', label: 'r3' };

      manager.subscribe(r1, openCallback);
      manager.subscribe(r2, openCallback);
      manager.subscribe(r3, openCallback);

      expect(manager.getRequestsForKey('a')).toEqual([r1, r2]);
      expect(manager.getRequestsForKey('b')).toEqual([r3]);

      manager.unsubscribe(r1);
      expect(manager.getRequestsForKey('a')).toEqual([r2]);
    });
  });

  describe('verify refcount and serialization are delegated to KSM', () => {
    it('should refcount per key: a single WS sub per key regardless of subscribers', async () => {
      const { manager } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a', label: 'first' }, openCallback);
      manager.subscribe({ key: 'a', label: 'second' }, openCallback);
      await flushPromises();

      expect(calls).toHaveLength(1);
    });

    it('should open distinct WS subs for distinct keys', async () => {
      const { manager } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      manager.subscribe({ key: 'b' }, openCallback);
      await flushPromises();

      expect(calls).toHaveLength(2);
    });
  });

  describe('time-spaced retries', () => {
    it('should not retry on subsequent HASS pushes; retries fire on the timer', async () => {
      useDeterministicTimers();
      const hass = createHASS();
      const { manager, push } = setup(hass);
      const failing = createFailingOpenCallback();

      manager.subscribe({ key: 'a' }, failing);
      await vi.advanceTimersByTimeAsync(0);
      expect(failing).toBeCalledTimes(1);

      // HASS pushes do not retry while the retry-timer is scheduled.
      for (let i = 0; i < 10; i++) {
        push(hass);
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(failing).toBeCalledTimes(1);
    });

    it('should retry after the backoff delay elapses', async () => {
      useDeterministicTimers();
      const { manager } = setup();
      const failing = createFailingOpenCallback();

      manager.subscribe({ key: 'a' }, failing);
      await vi.advanceTimersByTimeAsync(0);
      expect(failing).toBeCalledTimes(1);

      // 1st retry: ~1s.
      await vi.advanceTimersByTimeAsync(1000);
      expect(failing).toBeCalledTimes(2);

      // 2nd retry: ~2s.
      await vi.advanceTimersByTimeAsync(2000);
      expect(failing).toBeCalledTimes(3);

      // 3rd retry: ~4s.
      await vi.advanceTimersByTimeAsync(4000);
      expect(failing).toBeCalledTimes(4);
    });

    it('should reset the backoff on a connection swap', async () => {
      useDeterministicTimers();
      const { manager, push } = setup();
      const failing = createFailingOpenCallback();

      manager.subscribe({ key: 'a' }, failing);
      await vi.advanceTimersByTimeAsync(0);

      // Burn through a few backoff steps so the next would be a longer delay.
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      const callsBeforeSwap = vi.mocked(failing).mock.calls.length;

      // Swap. The fresh era should retry immediately on the new connection.
      push(createSwappedHASS());
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.mocked(failing).mock.calls.length).toBe(callsBeforeSwap + 1);

      // First retry on the new era is back at ~1s, not whatever the previous
      // era's accumulated delay was.
      await vi.advanceTimersByTimeAsync(1000);
      expect(vi.mocked(failing).mock.calls.length).toBe(callsBeforeSwap + 2);
    });

    it('should reset the backoff on a readiness transition (not-ready -> ready)', async () => {
      useDeterministicTimers();
      const ready = createHASS();
      const { manager, push } = setup(ready);
      const failing = createFailingOpenCallback();

      manager.subscribe({ key: 'a' }, failing);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      const callsBefore = vi.mocked(failing).mock.calls.length;

      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      push(notReady);

      push(ready);
      await vi.advanceTimersByTimeAsync(0);

      // Re-ready triggers a fresh era and a fresh submission.
      expect(vi.mocked(failing).mock.calls.length).toBe(callsBefore + 1);

      // Next retry is back to ~1s (fresh backoff).
      await vi.advanceTimersByTimeAsync(1000);
      expect(vi.mocked(failing).mock.calls.length).toBe(callsBefore + 2);
    });
  });

  describe('stale catch token guard', () => {
    it('should not let a stale rejection from a swapped-out KSM clear the new submission marker', async () => {
      const { manager, push } = setup();

      let rejectFirst: ((e: Error) => void) | undefined;
      const openCallback: HASSWebSocketOpenCallback = vi
        .fn()
        // First call (on the initial connection) rejects later.
        .mockImplementationOnce(
          () =>
            new Promise<() => Promise<void>>((_, reject) => {
              rejectFirst = reject;
            }),
        )
        // Subsequent calls succeed.
        .mockResolvedValue(vi.fn());

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();
      expect(openCallback).toBeCalledTimes(1);

      // Swap to a new connection BEFORE the first call settles.
      const hass2 = createSwappedHASS();
      push(hass2);
      await flushPromises();
      expect(openCallback).toBeCalledTimes(2);

      // Now reject the stale first call. The catch must NOT wipe the marker for
      // the in-flight second submission, so the next same-connection push must
      // NOT submit again.
      rejectFirst?.(new Error('boom'));
      await flushPromises();

      push(hass2);
      await flushPromises();
      expect(openCallback).toBeCalledTimes(2);
    });
  });

  describe('destroy', () => {
    it('should be a no-op when called without any subscribers', () => {
      const { manager, getListenerCount } = setup();
      manager.destroy();
      expect(getListenerCount()).toBe(0);
    });

    it('should swallow a failed KSM unsubscribe during drain', async () => {
      const { manager } = setup();
      const failingUnsub = vi.fn().mockRejectedValue(new Error('boom'));
      const openCallback: HASSWebSocketOpenCallback = vi
        .fn()
        .mockResolvedValue(failingUnsub);

      manager.subscribe({ key: 'a' }, openCallback);
      await flushPromises();

      manager.destroy();
      await flushPromises();

      expect(failingUnsub).toBeCalled();
    });

    it('should detach source listener, drain KSM, clear state, and flip guards dead', async () => {
      const { manager, getListenerCount } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      manager.subscribe({ key: 'a' }, openCallback);
      manager.subscribe({ key: 'b' }, openCallback);
      await flushPromises();

      const guardA = calls[0].guard;
      const guardB = calls[1].guard;
      expect(guardA.isConnected()).toBe(true);
      expect(guardB.isConnected()).toBe(true);

      manager.destroy();

      expect(getListenerCount()).toBe(0);
      expect(guardA.isConnected()).toBe(false);
      expect(guardB.isConnected()).toBe(false);
      expect(manager.getRequestsForKey('a')).toEqual([]);
      expect(manager.getRequestsForKey('b')).toEqual([]);
    });

    it('should close a subscription still queued in KSM when destroy is called', async () => {
      const { manager } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      // Destroy before KSM admits the subscribe task: the durable mirror still
      // drives teardown, so the subscription is closed once it opens rather
      // than leaking.
      manager.subscribe({ key: 'a' }, openCallback);
      manager.destroy();
      await flushPromises();

      expect(calls).toHaveLength(1);
      expect(calls[0].unsub).toBeCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('should not flip guards dead on unsubscribe as era still live for other subscribers', async () => {
      const { manager } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      const r1 = { key: 'a' };
      const r2 = { key: 'a' };
      manager.subscribe(r1, openCallback);
      manager.subscribe(r2, openCallback);
      await flushPromises();

      const guard = calls[0].guard;
      manager.unsubscribe(r1);
      expect(guard.isConnected()).toBe(true);
    });

    it('should detach from source when the last subscriber leaves', async () => {
      const { manager, getListenerCount } = setup();
      const { openCallback } = createRecordingOpenCallback();

      const req = { key: 'a' };
      manager.subscribe(req, openCallback);
      expect(getListenerCount()).toBe(1);

      manager.unsubscribe(req);
      expect(getListenerCount()).toBe(0);
    });

    it('should swallow a failed unsubscribe', async () => {
      const { manager } = setup();
      const failingUnsub = vi.fn().mockRejectedValue(new Error('boom'));
      const openCallback: HASSWebSocketOpenCallback = vi
        .fn()
        .mockResolvedValue(failingUnsub);

      const req = { key: 'a' };
      manager.subscribe(req, openCallback);
      await flushPromises();
      manager.unsubscribe(req);
      await flushPromises();

      expect(failingUnsub).toBeCalled();
    });
  });

  describe('status callback', () => {
    const collectStatuses = (): {
      statusCallback: HASSWebSocketStatusCallback<string, TestRequest>;
      events: HASSWebSocketSubscriptionStatus<string, TestRequest>[];
    } => {
      const events: HASSWebSocketSubscriptionStatus<string, TestRequest>[] = [];
      return { statusCallback: (s) => events.push(s), events };
    };

    it('should emit waiting then subscribed on a successful subscribe', async () => {
      const { manager } = setup();
      const { openCallback } = createRecordingOpenCallback();
      const { statusCallback, events } = collectStatuses();

      manager.subscribe({ key: 'a' }, openCallback, statusCallback);
      await flushPromises();

      expect(events.map((e) => e.state)).toEqual(['waiting', 'subscribed']);
      expect(events[1].failureCount).toBeUndefined();
      expect(events[1].error).toBeUndefined();
      expect(events[1].key).toBe('a');
    });

    it('should emit waiting when subscribed before HA is ready', () => {
      const { manager } = setup(null);
      const { openCallback } = createRecordingOpenCallback();
      const { statusCallback, events } = collectStatuses();

      manager.subscribe({ key: 'a' }, openCallback, statusCallback);

      expect(events).toHaveLength(1);
      expect(events[0].state).toBe('waiting');
    });

    it('should emit failing with the error and incremented failureCount', async () => {
      useDeterministicTimers();
      const { manager } = setup();
      const failing = createFailingOpenCallback();
      const { statusCallback, events } = collectStatuses();

      manager.subscribe({ key: 'a' }, failing, statusCallback);
      await vi.advanceTimersByTimeAsync(0);

      // waiting, failing(1).
      const failures = events.filter((e) => e.state === 'failing');
      expect(failures).toHaveLength(1);
      expect(String(failures[0].error)).toMatch(/boom/);
      expect(failures[0].failureCount).toBe(1);

      // Second attempt also fails -> failing(2).
      await vi.advanceTimersByTimeAsync(1000);
      const failures2 = events.filter((e) => e.state === 'failing');
      expect(failures2).toHaveLength(2);
      expect(failures2[1].failureCount).toBe(2);
    });

    it('should emit subscribed without a failureCount after eventual success', async () => {
      useDeterministicTimers();
      const { manager } = setup();
      const openCallback: HASSWebSocketOpenCallback = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(vi.fn().mockResolvedValue(undefined));
      const { statusCallback, events } = collectStatuses();

      manager.subscribe({ key: 'a' }, openCallback, statusCallback);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const subscribed = events.filter((e) => e.state === 'subscribed');
      expect(subscribed).toHaveLength(1);
      expect(subscribed[0].failureCount).toBeUndefined();
    });

    it('should emit unsubscribed on unsubscribe', async () => {
      const { manager } = setup();
      const { openCallback } = createRecordingOpenCallback();
      const { statusCallback, events } = collectStatuses();
      const req = { key: 'a' };

      manager.subscribe(req, openCallback, statusCallback);
      await flushPromises();
      const before = events.length;

      manager.unsubscribe(req);

      expect(events.length).toBe(before + 1);
      expect(events[events.length - 1].state).toBe('unsubscribed');
    });

    it('should not emit on unsubscribe for an unknown request', () => {
      const { manager } = setup();
      const { events } = collectStatuses();

      manager.unsubscribe({ key: 'never-subscribed' });

      expect(events).toHaveLength(0);
    });

    it('should emit waiting for all requests when HA goes not-ready', async () => {
      const { manager, push } = setup();
      const { openCallback } = createRecordingOpenCallback();
      const a = collectStatuses();
      const b = collectStatuses();

      manager.subscribe({ key: 'a' }, openCallback, a.statusCallback);
      manager.subscribe({ key: 'b' }, openCallback, b.statusCallback);
      await flushPromises();
      a.events.length = 0;
      b.events.length = 0;

      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      push(notReady);

      expect(a.events.map((e) => e.state)).toEqual(['waiting']);
      expect(b.events.map((e) => e.state)).toEqual(['waiting']);
    });

    it('should emit subscribed after an era reanimation', async () => {
      const { manager, push } = setup();
      const { openCallback } = createRecordingOpenCallback();
      const { statusCallback, events } = collectStatuses();

      manager.subscribe({ key: 'a' }, openCallback, statusCallback);
      await flushPromises();
      events.length = 0;

      push(createSwappedHASS());
      await flushPromises();

      expect(events.map((e) => e.state)).toEqual(['waiting', 'subscribed']);
    });

    it('should isolate a throwing status callback from the retry state machine', async () => {
      const { manager } = setup();
      const { openCallback, calls } = createRecordingOpenCallback();

      const events: HASSWebSocketSubscriptionStatus<string, TestRequest>[] = [];
      const statusCallback: HASSWebSocketStatusCallback<string, TestRequest> = (s) => {
        events.push(s);
        if (s.state === 'subscribed') {
          throw new Error('observer boom');
        }
      };

      manager.subscribe({ key: 'a' }, openCallback, statusCallback);
      await flushPromises();

      // The throw during `subscribed` is swallowed: no `failing` transition and
      // no retry.
      expect(events.map((e) => e.state)).toEqual(['waiting', 'subscribed']);
      expect(calls).toHaveLength(1);
    });
  });

  describe('retry', () => {
    it('should cancel the pending retry timer and submit immediately', async () => {
      useDeterministicTimers();
      const { manager } = setup();
      const openCallback: HASSWebSocketOpenCallback = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(vi.fn().mockResolvedValue(undefined));
      const req = { key: 'a' };

      manager.subscribe(req, openCallback);
      await vi.advanceTimersByTimeAsync(0);
      expect(openCallback).toBeCalledTimes(1);

      // Pending timer would fire ~1s from now. retry runs the second attempt
      // synchronously instead of waiting.
      manager.retry(req);
      await flushPromises();
      expect(openCallback).toBeCalledTimes(2);

      // Advance well past the original 1s schedule: nothing further fires.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(openCallback).toBeCalledTimes(2);
    });

    it('should reset the backoff so the next failure schedules at the base delay', async () => {
      useDeterministicTimers();
      const { manager } = setup();
      const failing = createFailingOpenCallback();
      const req = { key: 'a' };

      manager.subscribe(req, failing);

      // Burn through three failures to escalate the backoff.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(failing).toBeCalledTimes(3);

      // User clicks retry: counter resets. Next failure should schedule at ~1s
      // again, not ~8s.
      manager.retry(req);
      await flushPromises();
      expect(failing).toBeCalledTimes(4);
      await vi.advanceTimersByTimeAsync(999);
      expect(failing).toBeCalledTimes(4);
      await vi.advanceTimersByTimeAsync(1);
      expect(failing).toBeCalledTimes(5);
    });

    it('should be a no-op for an unknown request', () => {
      const { manager } = setup();
      expect(() => manager.retry({ key: 'never-subscribed' })).not.toThrow();
    });

    it('should not submit in a dead era, but reset the backoff for next era', async () => {
      useDeterministicTimers();
      const notReady = createHASS();
      notReady.config.state = STATE_STARTING;
      const { manager, push } = setup(notReady);
      const openCallback: HASSWebSocketOpenCallback = vi
        .fn()
        .mockResolvedValue(vi.fn().mockResolvedValue(undefined));
      const req = { key: 'a' };

      manager.subscribe(req, openCallback);
      await vi.advanceTimersByTimeAsync(0);
      expect(openCallback).not.toBeCalled();

      manager.retry(req);
      await flushPromises();
      expect(openCallback).not.toBeCalled();

      // Era starts; the request submits.
      const ready = createHASS();
      ready.config.state = STATE_RUNNING;
      push(ready);
      await flushPromises();
      expect(openCallback).toBeCalledTimes(1);
    });
  });
});
