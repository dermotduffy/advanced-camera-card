import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CameraConfig } from '../../src/config/schema/cameras';
import {
  formatLastFrameTime,
  getLastFrameKey,
  LastFrameStore,
} from '../../src/utils/last-frame-store';

const FRAME = { url: 'data:image/jpeg;base64,AAAA', capturedAt: new Date(1000) };
const OTHER_FRAME = { url: 'data:image/jpeg;base64,BBBB', capturedAt: new Date(2000) };

const DAY = 86400;

describe('LastFrameStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should have no frame by default', () => {
    expect(new LastFrameStore().get('camera')).toBeNull();
  });

  it('should keep a frame in memory and tell listeners', () => {
    vi.useFakeTimers({ now: 1500 });
    const store = new LastFrameStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set('camera', FRAME, DAY);

    expect(store.get('camera')).toEqual(expect.objectContaining(FRAME));
    expect(listener).toHaveBeenCalledWith('camera');

    unsubscribe();
    store.set('camera', OTHER_FRAME, DAY);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should keep one frame per key, the last', () => {
    vi.useFakeTimers({ now: 2500 });
    const store = new LastFrameStore();

    store.set('camera', FRAME, DAY);
    store.set('camera', OTHER_FRAME, DAY);

    expect(store.get('camera')).toEqual(expect.objectContaining(OTHER_FRAME));
  });

  it('should not return a frame past its maximum age, and drop it', () => {
    vi.useFakeTimers({ now: 1000 });
    const store = new LastFrameStore();
    store.set('camera', FRAME, 10);

    vi.setSystemTime(1000 + 9999);
    expect(store.get('camera')).toEqual(expect.objectContaining(FRAME));

    vi.setSystemTime(1000 + 10000);
    expect(store.get('camera')).toBeNull();

    // Dropped: still gone if the clock went back.
    vi.setSystemTime(1000);
    expect(store.get('camera')).toBeNull();
  });

  it('should drop expired frames of other keys when storing one', () => {
    vi.useFakeTimers({ now: 1000 });
    const store = new LastFrameStore();
    store.set('old', FRAME, 10);
    store.set('fresh', FRAME, DAY);

    vi.setSystemTime(1000 + 20000);
    store.set('camera', OTHER_FRAME, DAY);

    // Dropped when the last frame was stored: still gone if the clock went back.
    vi.setSystemTime(1000);
    expect(store.get('old')).toBeNull();
    expect(store.get('fresh')).toEqual(expect.objectContaining(FRAME));
  });
});

describe('getLastFrameKey', () => {
  const config = (entity: string): CameraConfig =>
    ({ camera_entity: entity, id: 'front' }) as unknown as CameraConfig;

  it('should be the ID alone without a configuration', () => {
    expect(getLastFrameKey('camera')).toBe('camera');
    expect(getLastFrameKey('camera', null)).toBe('camera');
  });

  it('should be equal for the same camera and differ for another under the same ID', () => {
    expect(getLastFrameKey('front', config('camera.a'))).toBe(
      getLastFrameKey('front', config('camera.a')),
    );
    expect(getLastFrameKey('front', config('camera.a'))).not.toBe(
      getLastFrameKey('front', config('camera.b')),
    );
  });
});

describe('formatLastFrameTime', () => {
  const capturedAt = new Date(2026, 10, 7, 9, 5);
  const today = new Date(2026, 10, 7, 23, 0);

  it('should show the time alone for a frame from today', () => {
    expect(formatLastFrameTime(capturedAt, { language: 'en-GB' }, today)).toBe('09:05');
  });

  it('should add the date for a frame from another day', () => {
    expect(
      formatLastFrameTime(
        capturedAt,
        { language: 'en-GB' },
        new Date(2026, 10, 8, 1, 0),
      ),
    ).toBe('7 Nov, 09:05');
  });

  it("should follow the profile's time format", () => {
    expect(
      formatLastFrameTime(capturedAt, { language: 'en-GB', time_format: '12' }, today),
    ).toMatch(/^09:05\s?am$/i);
    expect(
      formatLastFrameTime(capturedAt, { language: 'en-US', time_format: '24' }, today),
    ).toBe('09:05');
    expect(
      formatLastFrameTime(
        capturedAt,
        { language: 'en-GB', time_format: 'language' },
        today,
      ),
    ).toBe('09:05');
  });

  it("should use the system's locale for the system time format", () => {
    expect(
      formatLastFrameTime(
        capturedAt,
        { language: 'en-US', time_format: 'system' },
        today,
      ),
    ).toBe(capturedAt.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' }));
  });

  it('should default to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 12, 0));
    expect(formatLastFrameTime(capturedAt, { language: 'en-GB' })).toBe('09:05');
    vi.useRealTimers();
  });
});
