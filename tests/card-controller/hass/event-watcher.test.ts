import type { Connection, HassEvent } from 'home-assistant-js-websocket';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { EventWatcher } from '../../../src/card-controller/hass/event-watcher';
import type { HomeAssistant } from '../../../src/ha/types';
import {
  createHASS,
  createHASSEvent,
  createHASSSource,
  flushPromises,
  useDeterministicTimers,
} from '../../test-utils';

// Drive the dispatcher registered with `hass.connection.subscribeEvents` to
// simulate an event arriving over the WS bus.
const fireEvent = (hass: HomeAssistant, event: HassEvent, n = 0): void => {
  const mock = vi.mocked(hass.connection.subscribeEvents).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0]?.(event);
};

// @vitest-environment jsdom
describe('EventWatcher', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should open a WS subscription keyed by event_type', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);

    watcher.subscribe({ event_type: 'zha_event', callback: vi.fn() });
    await flushPromises();

    expect(hass.connection.subscribeEvents).toHaveBeenCalledTimes(1);
    expect(vi.mocked(hass.connection.subscribeEvents).mock.calls[0][1]).toBe(
      'zha_event',
    );
  });

  it('should share one WS subscription across subscribers with the same event_type', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);

    watcher.subscribe({ event_type: 'zha_event', callback: vi.fn() });
    watcher.subscribe({ event_type: 'zha_event', callback: vi.fn() });
    await flushPromises();

    expect(hass.connection.subscribeEvents).toHaveBeenCalledTimes(1);
  });

  it('should open separate WS subscriptions for distinct event_types', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);

    watcher.subscribe({ event_type: 'zha_event', callback: vi.fn() });
    watcher.subscribe({ event_type: 'deconz_event', callback: vi.fn() });
    await flushPromises();

    expect(hass.connection.subscribeEvents).toHaveBeenCalledTimes(2);
  });

  it('should dispatch to every subscriber whose event_type matches', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const event = createHASSEvent('zha_event', { command: 'press' });

    watcher.subscribe({ event_type: 'zha_event', callback: cb1 });
    watcher.subscribe({ event_type: 'zha_event', callback: cb2 });
    await flushPromises();

    fireEvent(hass, event);

    expect(cb1).toHaveBeenCalledWith(event);
    expect(cb2).toHaveBeenCalledWith(event);
  });

  it('should gate dispatch on the request matcher when provided', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);
    const cb = vi.fn();
    const matcher = vi.fn((event: HassEvent) => (event.data as { x?: number }).x === 1);

    const matching = createHASSEvent('zha_event', { x: 1 });
    const nonMatching = createHASSEvent('zha_event', { x: 2 });
    watcher.subscribe({ event_type: 'zha_event', matcher, callback: cb });
    await flushPromises();

    fireEvent(hass, matching);
    fireEvent(hass, nonMatching);

    expect(matcher).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(matching);
  });

  it('should tear down the WS subscription only when the last subscriber unsubscribes', async () => {
    const hass = createHASS();
    const unsub = vi.fn();
    vi.mocked(hass.connection.subscribeEvents).mockResolvedValue(unsub);
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);
    const req1 = { event_type: 'zha_event', callback: vi.fn() };
    const req2 = { event_type: 'zha_event', callback: vi.fn() };

    watcher.subscribe(req1);
    watcher.subscribe(req2);
    await flushPromises();

    watcher.unsubscribe(req1);
    await flushPromises();
    expect(unsub).not.toHaveBeenCalled();

    watcher.unsubscribe(req2);
    await flushPromises();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('should drop events from an old-connection subscription after a swap', async () => {
    const oldHass = createHASS();
    const { source, push } = createHASSSource(oldHass);
    const watcher = new EventWatcher(source);
    const cb = vi.fn();

    watcher.subscribe({ event_type: 'zha_event', callback: cb });
    await flushPromises();

    // Capture the dispatcher registered against the OLD connection BEFORE
    // the swap, so it still points at the source-bound guard.
    const oldDispatcher = vi.mocked(oldHass.connection.subscribeEvents).mock.calls[0][0];

    const newHass = createHASS();
    newHass.connection = mock<Connection>();
    vi.mocked(newHass.connection.subscribeEvents).mockResolvedValue(vi.fn());
    push(newHass);
    await flushPromises();

    // Old dispatcher fires: guard.isConnected() is now false, callback must NOT
    // receive the event.
    oldDispatcher?.(createHASSEvent('zha_event', { command: 'press' }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('should not dispatch to a subscriber that registers mid-dispatch', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new EventWatcher(source);
    const lateCallback = vi.fn();
    const reentrantCallback = vi.fn(() => {
      watcher.subscribe({ event_type: 'zha_event', callback: lateCallback });
    });

    watcher.subscribe({ event_type: 'zha_event', callback: reentrantCallback });
    await flushPromises();

    fireEvent(hass, createHASSEvent('zha_event', { command: 'press' }));

    expect(reentrantCallback).toHaveBeenCalledTimes(1);
    expect(lateCallback).not.toHaveBeenCalled();
  });

  describe('subscription health monitoring', () => {
    it('should surface and retry failing subscriptions through getHealth', async () => {
      useDeterministicTimers();

      const hass = createHASS();
      vi.mocked(hass.connection.subscribeEvents).mockRejectedValue(new Error('boom'));
      const { source } = createHASSSource(hass);
      const watcher = new EventWatcher(source);

      watcher.subscribe({ event_type: 'zha_event', callback: vi.fn() });
      await flushPromises();

      expect(
        watcher
          .getHealth()
          .getFailures()
          .map((failure) => failure.key),
      ).toEqual(['zha_event']);

      const before = vi.mocked(hass.connection.subscribeEvents).mock.calls.length;

      watcher.getHealth().retry();

      await flushPromises();
      expect(vi.mocked(hass.connection.subscribeEvents).mock.calls.length).toBe(
        before + 1,
      );
    });
  });
});
