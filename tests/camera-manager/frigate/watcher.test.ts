import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FrigateEventChange,
  FrigateReviewChange,
} from '../../../src/camera-manager/frigate/types.js';
import {
  FrigateEventWatcher,
  FrigateReviewWatcher,
} from '../../../src/camera-manager/frigate/watcher.js';
import { HomeAssistant } from '../../../src/ha/types.js';
import { createHASS } from '../../test-utils.js';

const createEventChange = (): FrigateEventChange => {
  return {
    type: 'new',
    before: {
      camera: 'front_door',
      snapshot: null,
      has_clip: false,
      has_snapshot: false,
      label: 'person',
      current_zones: [],
    },
    after: {
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
const callHASubscribeMessageCallback = (
  hass: HomeAssistant,
  data: unknown,
  n = 0,
): void => {
  const mock = vi.mocked(hass.connection.subscribeMessage).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0](data);
};

describe('FrigateEventWatcher', () => {
  it('should subscribe to a given topic once', async () => {
    const stateWatcher = new FrigateEventWatcher();
    const hass = createHASS();

    await stateWatcher.subscribe(hass, {
      instanceID: 'frigate',
      callback: vi.fn(),
    });

    await stateWatcher.subscribe(hass, {
      instanceID: 'frigate',
      callback: vi.fn(),
    });

    expect(hass.connection.subscribeMessage).toBeCalledTimes(1);
  });

  it('should only subscribe from a given topic once', async () => {
    const stateWatcher = new FrigateEventWatcher();
    const hass = createHASS();

    const unsubscribeCallback = vi.fn();
    vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsubscribeCallback);

    const request_1 = {
      instanceID: 'frigate',
      callback: vi.fn(),
    };
    const request_2 = { ...request_1 };

    await stateWatcher.subscribe(hass, request_1);
    await stateWatcher.subscribe(hass, request_2);

    await stateWatcher.unsubscribe(request_1);
    expect(unsubscribeCallback).not.toBeCalled();

    await stateWatcher.unsubscribe(request_2);
    expect(unsubscribeCallback).toBeCalledTimes(1);
  });

  describe('should call handler', () => {
    afterEach(() => {
      vi.resetAllMocks();
    });

    it('with invalid JSON', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const stateWatcher = new FrigateEventWatcher();
      const hass = createHASS();

      const callback = vi.fn();
      const request = {
        instanceID: 'frigate',
        callback: callback,
      };

      await stateWatcher.subscribe(hass, request);
      callHASubscribeMessageCallback(hass, 'NOT_JSON');

      expect(callback).not.toBeCalled();
      expect(spy).toBeCalledWith(
        'Received non-JSON payload from subscription: frigate/events/subscribe',
        'NOT_JSON',
      );
    });

    it('with malformed event', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const stateWatcher = new FrigateEventWatcher();
      const hass = createHASS();

      const callback = vi.fn();
      const request = {
        instanceID: 'frigate',
        callback: callback,
      };

      await stateWatcher.subscribe(hass, request);
      const data = JSON.stringify({});
      callHASubscribeMessageCallback(hass, data);

      expect(callback).not.toBeCalled();
      expect(spy).toBeCalledWith(
        'Received malformed message from subscription: frigate/events/subscribe',
        data,
      );
    });

    it('without a matcher', async () => {
      const stateWatcher = new FrigateEventWatcher();
      const hass = createHASS();

      const callback = vi.fn();
      const request = {
        instanceID: 'frigate',
        callback: callback,
      };

      await stateWatcher.subscribe(hass, request);
      const eventChange = createEventChange();
      callHASubscribeMessageCallback(hass, JSON.stringify(eventChange));

      expect(callback).toBeCalledWith(eventChange);
    });

    it('with a non-matching instance_id', async () => {
      const stateWatcher = new FrigateEventWatcher();
      const hass = createHASS();

      const callback_1 = vi.fn();
      const request_1 = {
        instanceID: 'frigate_1',
        callback: callback_1,
      };

      const callback_2 = vi.fn();
      const request_2 = {
        instanceID: 'frigate_2',
        callback: callback_2,
      };

      await stateWatcher.subscribe(hass, request_1);
      await stateWatcher.subscribe(hass, request_2);

      const eventChange = createEventChange();
      callHASubscribeMessageCallback(hass, JSON.stringify(eventChange), 1);

      expect(callback_1).not.toBeCalledWith(eventChange);
      expect(callback_2).toBeCalledWith(eventChange);
    });

    it('with a matcher', async () => {
      const stateWatcher = new FrigateEventWatcher();
      const hass = createHASS();

      const matching_callback = vi.fn();
      const matching_request = {
        instanceID: 'frigate',
        callback: matching_callback,
        matcher: (event: FrigateEventChange) => event.after.camera === 'front_door',
      };

      const non_matching_callback = vi.fn();
      const non_matching_request = {
        instanceID: 'frigate',
        callback: non_matching_callback,
        matcher: (event: FrigateEventChange) => event.after.camera === 'back_door',
      };

      await stateWatcher.subscribe(hass, matching_request);
      await stateWatcher.subscribe(hass, non_matching_request);

      const eventChange = createEventChange();
      callHASubscribeMessageCallback(hass, JSON.stringify(eventChange));

      expect(non_matching_callback).not.toBeCalledWith(eventChange);
      expect(matching_callback).toBeCalledWith(eventChange);
    });
  });
});

describe('FrigateReviewWatcher', () => {
  it('should subscribe to a given topic once', async () => {
    const stateWatcher = new FrigateReviewWatcher();
    const hass = createHASS();

    await stateWatcher.subscribe(hass, {
      instanceID: 'frigate',
      callback: vi.fn(),
    });

    await stateWatcher.subscribe(hass, {
      instanceID: 'frigate',
      callback: vi.fn(),
    });

    expect(hass.connection.subscribeMessage).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        type: 'frigate/reviews/subscribe',
      }),
    );
    expect(hass.connection.subscribeMessage).toBeCalledTimes(1);
  });

  describe('should call handler', () => {
    afterEach(() => {
      vi.resetAllMocks();
    });

    it('with a review change', async () => {
      const stateWatcher = new FrigateReviewWatcher();
      const hass = createHASS();

      const callback = vi.fn();
      const request = {
        instanceID: 'frigate',
        callback: callback,
      };

      await stateWatcher.subscribe(hass, request);

      const reviewChange = createReviewChange();

      callHASubscribeMessageCallback(hass, JSON.stringify(reviewChange));

      expect(callback).toBeCalledWith(reviewChange);
    });

    it('with invalid JSON', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const stateWatcher = new FrigateReviewWatcher();
      const hass = createHASS();

      const callback = vi.fn();
      const request = {
        instanceID: 'frigate',
        callback: callback,
      };

      await stateWatcher.subscribe(hass, request);
      callHASubscribeMessageCallback(hass, 'NOT_JSON');

      expect(callback).not.toBeCalled();
      expect(spy).toBeCalledWith(
        'Received non-JSON payload from subscription: frigate/reviews/subscribe',
        'NOT_JSON',
      );
    });
  });
});
