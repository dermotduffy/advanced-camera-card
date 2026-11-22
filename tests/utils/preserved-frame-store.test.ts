import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PreservedFrameStore,
  sharedPreservedFrameStore,
} from '../../src/utils/preserved-frame-store';
import { createPreservedFrame } from './test-utils';

const date = new Date('2026-11-17T12:00:00');

describe('PreservedFrameStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return no frame for a camera that has none', () => {
    const store = new PreservedFrameStore();

    expect(store.get({ cameraID: 'camera-1' }, 60)).toBeNull();
  });

  it('should return a stored frame', () => {
    const store = new PreservedFrameStore();
    const frame = createPreservedFrame();

    store.set({ cameraID: 'camera-1' }, frame);

    expect(store.get({ cameraID: 'camera-1' }, 60)).toBe(frame);
  });

  it('should not return the frame of another camera', () => {
    const store = new PreservedFrameStore();
    const frame = createPreservedFrame();

    store.set({ cameraID: 'camera-1' }, frame);

    expect(store.get({ cameraID: 'camera-2' }, 60)).toBeNull();
  });

  it('should not return the frame of another card', () => {
    const store = new PreservedFrameStore();
    const frame = createPreservedFrame();

    store.set({ cardID: 'card-1', cameraID: 'camera-1' }, frame);

    expect(store.get({ cardID: 'card-1', cameraID: 'camera-1' }, 60)).toBe(frame);
    expect(store.get({ cardID: 'card-2', cameraID: 'camera-1' }, 60)).toBeNull();
    expect(store.get({ cameraID: 'camera-1' }, 60)).toBeNull();
  });

  it('should replace the frame of a camera when a different frame is stored', () => {
    const store = new PreservedFrameStore();
    const replacement = createPreservedFrame({
      url: 'data:image/jpeg;base64,replacement',
    });

    store.set({ cameraID: 'camera-1' }, createPreservedFrame());
    store.set({ cameraID: 'camera-1' }, replacement);

    expect(store.get({ cameraID: 'camera-1' }, 60)).toBe(replacement);
  });

  it('should keep the original date when the same frame is stored again', () => {
    const store = new PreservedFrameStore();
    const frame = createPreservedFrame();

    store.set({ cameraID: 'camera-1' }, frame);
    store.set(
      { cameraID: 'camera-1' },
      createPreservedFrame({ date: new Date(date.getTime() + 30 * 1000) }),
    );

    expect(store.get({ cameraID: 'camera-1' }, 60)).toBe(frame);
  });

  it('should not replace a frame with an older one', () => {
    const store = new PreservedFrameStore();
    const frame = createPreservedFrame();

    store.set({ cameraID: 'camera-1' }, frame);
    store.set(
      { cameraID: 'camera-1' },
      createPreservedFrame({
        url: 'data:image/jpeg;base64,older',
        date: new Date(date.getTime() - 1000),
      }),
    );

    expect(store.get({ cameraID: 'camera-1' }, 60)).toBe(frame);
  });

  it('should replace a frame with another of the same date', () => {
    const store = new PreservedFrameStore();
    const replacement = createPreservedFrame({
      url: 'data:image/jpeg;base64,replacement',
      date,
    });

    store.set({ cameraID: 'camera-1' }, createPreservedFrame({ date }));
    store.set({ cameraID: 'camera-1' }, replacement);

    expect(store.get({ cameraID: 'camera-1' }, 60)).toBe(replacement);
  });

  describe('should expire a frame', () => {
    it('should return a frame that is younger than the maximum age', () => {
      const store = new PreservedFrameStore();
      const frame = createPreservedFrame();
      store.set({ cameraID: 'camera-1' }, frame);

      vi.advanceTimersByTime(59 * 1000);

      expect(store.get({ cameraID: 'camera-1' }, 60)).toBe(frame);
    });

    it('should not return a frame at the moment it expires', () => {
      const store = new PreservedFrameStore();
      store.set({ cameraID: 'camera-1' }, createPreservedFrame());

      vi.advanceTimersByTime(60 * 1000);

      expect(store.get({ cameraID: 'camera-1' }, 60)).toBeNull();
    });

    it('should not return any frame for a maximum age of zero', () => {
      const store = new PreservedFrameStore();
      store.set({ cameraID: 'camera-1' }, createPreservedFrame());

      expect(store.get({ cameraID: 'camera-1' }, 0)).toBeNull();
    });

    it('should return the seconds until a frame expires', () => {
      const store = new PreservedFrameStore();
      const frame = createPreservedFrame();

      vi.advanceTimersByTime(20 * 1000);

      expect(store.getSecondsUntilExpired(frame, 60)).toBe(40);
    });

    it('should return zero or fewer seconds for an expired frame', () => {
      const store = new PreservedFrameStore();
      const frame = createPreservedFrame();

      vi.advanceTimersByTime(90 * 1000);

      expect(store.getSecondsUntilExpired(frame, 60)).toBe(-30);
    });
  });

  it('should drop the least recently used frames once full', () => {
    const store = new PreservedFrameStore();
    for (let i = 0; i < 20; i++) {
      store.set(
        { cameraID: `camera-${i}` },
        createPreservedFrame({ url: `data:image/jpeg;base64,${i}` }),
      );
    }

    expect(store.get({ cameraID: 'camera-0' }, 60)).toBeNull();
    expect(store.get({ cameraID: 'camera-19' }, 60)).not.toBeNull();
  });

  describe('should tell listeners of stored frames', () => {
    it('should call a listener with the key of a stored frame', () => {
      const store = new PreservedFrameStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.set({ cardID: 'card-1', cameraID: 'camera-1' }, createPreservedFrame());

      expect(listener).toHaveBeenCalledWith({ cardID: 'card-1', cameraID: 'camera-1' });
    });

    it('should not call a listener when the same frame is stored again', () => {
      const store = new PreservedFrameStore();
      const listener = vi.fn();
      store.set({ cameraID: 'camera-1' }, createPreservedFrame());
      store.subscribe(listener);

      store.set({ cameraID: 'camera-1' }, createPreservedFrame());

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not call a listener once it unsubscribes', () => {
      const store = new PreservedFrameStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      store.set({ cameraID: 'camera-1' }, createPreservedFrame());

      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('should share one store across the page', () => {
    expect(sharedPreservedFrameStore).toBeInstanceOf(PreservedFrameStore);
  });
});
