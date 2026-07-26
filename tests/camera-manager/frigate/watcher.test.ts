import type { Connection } from 'home-assistant-js-websocket';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type {
  FrigateEventChange,
  FrigateReviewChange,
} from '../../../src/camera-manager/frigate/types.js';
import {
  FrigateEventWatcher,
  FrigateReviewWatcher,
} from '../../../src/camera-manager/frigate/watcher.js';
import type { HomeAssistant } from '../../../src/ha/types.js';
import { createHASS, createHASSSource, flushPromises } from '../../test-utils.js';

const createEventChange = (): FrigateEventChange => {
  return {
    type: 'new',
    before: {
      id: '1234.5678',
      camera: 'front_door',
      snapshot: null,
      has_clip: false,
      has_snapshot: false,
      label: 'person',
      current_zones: [],
    },
    after: {
      id: '1234.5678',
      camera: 'front_door',
      snapshot: null,
      has_clip: true,
      has_snapshot: true,
      label: 'person',
      current_zones: [],
    },
  };
};
const createReviewChange = (): FrigateReviewChange => {
  return {
    type: 'new',
    before: {
      id: '123',
      camera: 'front_door',
      severity: 'alert',
      start_time: 123,
      end_time: null,
      thumb_path: null,
      has_been_reviewed: false,
      data: {
        metadata: {
          title: 'Title before',
          scene: 'Scene before',
        },
      },
    },
    after: {
      id: '123',
      camera: 'front_door',
      severity: 'alert',
      start_time: 123,
      end_time: null,
      thumb_path: null,
      has_been_reviewed: false,
      data: {
        metadata: {
          title: 'Title after',
          scene: 'Scene after',
        },
      },
    },
  };
};

// Drive the dispatcher registered with `hass.connection.subscribeMessage` to
// simulate a Frigate WS message arriving over the bus.
const fireMessage = (hass: HomeAssistant, data: unknown, n = 0): void => {
  const mock = vi.mocked(hass.connection.subscribeMessage).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0](data);
};

describe('FrigateEventWatcher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open a WS subscription with the frigate event type and instance id', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new FrigateEventWatcher(source);

    watcher.subscribe({ instanceID: 'frigate', callback: vi.fn() });
    await flushPromises();

    expect(hass.connection.subscribeMessage).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        type: 'frigate/events/subscribe',
        instance_id: 'frigate',
      }),
    );
  });

  it('should unsubscribe from the WS subscription', async () => {
    const hass = createHASS();
    const unsub = vi.fn();
    vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsub);
    const { source } = createHASSSource(hass);
    const watcher = new FrigateEventWatcher(source);
    const request = { instanceID: 'frigate', callback: vi.fn() };

    watcher.subscribe(request);
    await flushPromises();

    watcher.unsubscribe(request);
    await flushPromises();

    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('should drop messages from an old-connection subscription after a swap', async () => {
    const oldHass = createHASS();
    const { source, push } = createHASSSource(oldHass);
    const watcher = new FrigateEventWatcher(source);
    const callback = vi.fn();

    watcher.subscribe({ instanceID: 'frigate', callback });
    await flushPromises();

    // Capture the dispatcher registered against the OLD connection before the
    // swap, so it still points at the now-stale era guard.
    const oldDispatcher = vi.mocked(oldHass.connection.subscribeMessage).mock
      .calls[0][0];

    const newHass = createHASS();
    newHass.connection = mock<Connection>();
    vi.mocked(newHass.connection.subscribeMessage).mockResolvedValue(vi.fn());
    push(newHass);
    await flushPromises();

    oldDispatcher(JSON.stringify(createEventChange()));
    expect(callback).not.toHaveBeenCalled();
  });

  describe('should call handler', () => {
    it('with invalid JSON', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const hass = createHASS();
      const { source } = createHASSSource(hass);
      const watcher = new FrigateEventWatcher(source);

      const callback = vi.fn();
      watcher.subscribe({ instanceID: 'frigate', callback });
      await flushPromises();
      fireMessage(hass, 'NOT_JSON');

      expect(callback).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(
        'Received non-JSON payload from subscription: frigate/events/subscribe',
        'NOT_JSON',
      );
    });

    it('with malformed event', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const hass = createHASS();
      const { source } = createHASSSource(hass);
      const watcher = new FrigateEventWatcher(source);

      const callback = vi.fn();
      watcher.subscribe({ instanceID: 'frigate', callback });
      await flushPromises();
      const data = JSON.stringify({});
      fireMessage(hass, data);

      expect(callback).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(
        'Received malformed message from subscription: frigate/events/subscribe',
        data,
      );
    });

    it('without a matcher', async () => {
      const hass = createHASS();
      const { source } = createHASSSource(hass);
      const watcher = new FrigateEventWatcher(source);

      const callback = vi.fn();
      watcher.subscribe({ instanceID: 'frigate', callback });
      await flushPromises();
      const eventChange = createEventChange();
      fireMessage(hass, JSON.stringify(eventChange));

      expect(callback).toHaveBeenCalledWith(eventChange);
    });

    it('with a matcher', async () => {
      const hass = createHASS();
      const { source } = createHASSSource(hass);
      const watcher = new FrigateEventWatcher(source);

      const matching_callback = vi.fn();
      const non_matching_callback = vi.fn();
      watcher.subscribe({
        instanceID: 'frigate',
        callback: matching_callback,
        matcher: (event: FrigateEventChange) => event.after.camera === 'front_door',
      });
      watcher.subscribe({
        instanceID: 'frigate',
        callback: non_matching_callback,
        matcher: (event: FrigateEventChange) => event.after.camera === 'back_door',
      });
      await flushPromises();

      const eventChange = createEventChange();
      fireMessage(hass, JSON.stringify(eventChange));

      expect(non_matching_callback).not.toHaveBeenCalledWith(eventChange);
      expect(matching_callback).toHaveBeenCalledWith(eventChange);
    });
  });
});

describe('FrigateReviewWatcher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should subscribe to the frigate reviews channel and dispatch review changes', async () => {
    const hass = createHASS();
    const { source } = createHASSSource(hass);
    const watcher = new FrigateReviewWatcher(source);

    const callback = vi.fn();
    watcher.subscribe({ instanceID: 'frigate', callback });
    await flushPromises();

    expect(hass.connection.subscribeMessage).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        type: 'frigate/reviews/subscribe',
      }),
    );

    const reviewChange = createReviewChange();
    fireMessage(hass, JSON.stringify(reviewChange));

    expect(callback).toHaveBeenCalledWith(reviewChange);
  });
});
