import { HassEvent } from 'home-assistant-js-websocket';
import { describe, expect, it, vi } from 'vitest';
import { EventWatcher } from '../../../src/card-controller/hass/event-watcher';
import { HomeAssistant } from '../../../src/ha/types';
import { createHASS } from '../../test-utils';

const fireEvent = (hass: HomeAssistant, event: HassEvent, n = 0): void => {
  const mock = vi.mocked(hass.connection.subscribeEvents).mock;
  expect(mock.calls.length).greaterThan(n);

  // subscribeEvents(callback, event_type) -- callback is the first argument.
  mock.calls[n][0]?.(event);
};

const createHassEvent = (event_type: string, data: object = {}): HassEvent => ({
  event_type,
  data: data as { [key: string]: string },
  origin: 'LOCAL',
  time_fired: '2026-05-25T00:00:00Z',
  context: { id: 'ctx', user_id: null, parent_id: null },
});

describe('EventWatcher', () => {
  it('opens a single WS subscription per event_type regardless of subscribers', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();

    await watcher.subscribe(hass, { event_type: 'zha_event', callback: vi.fn() });
    await watcher.subscribe(hass, { event_type: 'zha_event', callback: vi.fn() });

    expect(hass.connection.subscribeEvents).toBeCalledTimes(1);
    expect(vi.mocked(hass.connection.subscribeEvents).mock.calls[0][1]).toBe(
      'zha_event',
    );
  });

  it('opens separate WS subscriptions for distinct event_types', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();

    await watcher.subscribe(hass, { event_type: 'zha_event', callback: vi.fn() });
    await watcher.subscribe(hass, { event_type: 'deconz_event', callback: vi.fn() });

    expect(hass.connection.subscribeEvents).toBeCalledTimes(2);
  });

  it('only tears down the WS subscription when the last subscriber unsubscribes', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();
    const unsub = vi.fn();
    vi.mocked(hass.connection.subscribeEvents).mockResolvedValue(unsub);

    const req1 = { event_type: 'zha_event', callback: vi.fn() };
    const req2 = { event_type: 'zha_event', callback: vi.fn() };
    await watcher.subscribe(hass, req1);
    await watcher.subscribe(hass, req2);

    await watcher.unsubscribe(req1);
    expect(unsub).not.toBeCalled();

    await watcher.unsubscribe(req2);
    expect(unsub).toBeCalledTimes(1);
  });

  it('dispatches to all subscribers whose event_type matches', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    await watcher.subscribe(hass, { event_type: 'zha_event', callback: cb1 });
    await watcher.subscribe(hass, { event_type: 'zha_event', callback: cb2 });

    fireEvent(hass, createHassEvent('zha_event', { command: 'press' }));

    expect(cb1).toBeCalledWith({ command: 'press' });
    expect(cb2).toBeCalledWith({ command: 'press' });
  });

  it('drops events whose event_type does not match the request', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();
    const cb = vi.fn();

    await watcher.subscribe(hass, { event_type: 'zha_event', callback: cb });
    // Inject an unrelated event into the shared dispatcher.
    fireEvent(hass, createHassEvent('other_event', { x: 1 }));

    expect(cb).not.toBeCalled();
  });

  it('gates dispatch on the request matcher when provided', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();
    const cb = vi.fn();
    const matcher = vi.fn((data: unknown) => (data as { x?: number }).x === 1);

    await watcher.subscribe(hass, { event_type: 'zha_event', matcher, callback: cb });

    fireEvent(hass, createHassEvent('zha_event', { x: 1 }));
    fireEvent(hass, createHassEvent('zha_event', { x: 2 }));

    expect(matcher).toBeCalledTimes(2);
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({ x: 1 });
  });

  it('handles unsubscribe during a still-pending subscribe without leaking', async () => {
    const watcher = new EventWatcher();
    const hass = createHASS();
    const unsub = vi.fn();

    let resolveSubscription: ((cb: () => Promise<void>) => void) | undefined;
    const subscriptionPromise = new Promise<() => Promise<void>>((resolve) => {
      resolveSubscription = resolve;
    });
    vi.mocked(hass.connection.subscribeEvents).mockReturnValue(subscriptionPromise);

    const req = { event_type: 'zha_event', callback: vi.fn() };
    const subscribePromise = watcher.subscribe(hass, req);

    // Unsubscribe before the underlying connection has resolved.
    const unsubscribePromise = watcher.unsubscribe(req);

    // Resolve the connection -- the watcher should now have the unsub fn and
    // call it as part of completing the unsubscribe.
    resolveSubscription?.(unsub);
    await subscribePromise;
    await unsubscribePromise;

    expect(unsub).toBeCalledTimes(1);
  });
});
