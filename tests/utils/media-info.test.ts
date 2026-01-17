import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MediaLoadedCapabilities, MediaPlayer } from '../../src/types';
import {
  createMediaLoadedInfo,
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaUnloadedEvent,
  dispatchMediaVolumeChangeEvent,
  isValidMediaLoadedInfo,
} from '../../src/utils/media-info';
import { createMediaLoadedInfo as createTestMediaLoadedInfo } from '../test-utils.js';

const options = {
  player: mock<MediaPlayer>(),
  capabilities: mock<MediaLoadedCapabilities>(),
};

// @vitest-environment jsdom
describe('createMediaLoadedInfo', () => {
  it('should create from image', () => {
    const img = document.createElement('img');

    // Need to write readonly properties.
    Object.defineProperty(img, 'naturalWidth', { value: 10 });
    Object.defineProperty(img, 'naturalHeight', { value: 20 });

    expect(createMediaLoadedInfo(img, options)).toEqual({
      width: 10,
      height: 20,
      ...options,
    });
  });

  it('should create from video', () => {
    const video = document.createElement('video');

    // Need to write readonly properties.
    Object.defineProperty(video, 'videoWidth', { value: 30 });
    Object.defineProperty(video, 'videoHeight', { value: 40 });

    expect(createMediaLoadedInfo(video, options)).toEqual({
      width: 30,
      height: 40,
      ...options,
    });
  });

  it('should create from canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 60;

    expect(createMediaLoadedInfo(canvas, options)).toEqual({
      width: 50,
      height: 60,
      ...options,
    });
  });

  it('should not create from unknown', () => {
    const div = document.createElement('div');
    expect(createMediaLoadedInfo(div, options)).toBeNull();
  });

  it('should create from event', () => {
    const img = document.createElement('img');

    // Need to write readonly properties.
    Object.defineProperty(img, 'naturalWidth', { value: 70 });
    Object.defineProperty(img, 'naturalHeight', { value: 80 });

    const event = new Event('foo');
    Object.defineProperty(event, 'composedPath', { value: () => [img] });

    expect(createMediaLoadedInfo(event, options)).toEqual({
      width: 70,
      height: 80,
      ...options,
    });
  });
});

// @vitest-environment jsdom
describe('dispatchMediaLoadedEvent', () => {
  const options = {
    player: mock<MediaPlayer>(),
    capabilities: mock<MediaLoadedCapabilities>(),
  };

  it('should dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:loaded', handler);

    // Need to write readonly properties.
    const img = document.createElement('img');
    Object.defineProperty(img, 'naturalWidth', { value: 10 });
    Object.defineProperty(img, 'naturalHeight', { value: 20 });

    dispatchMediaLoadedEvent(div, img, options);
    expect(handler).toBeCalledWith(
      expect.objectContaining({
        detail: {
          width: 10,
          height: 20,
          ...options,
        },
      }),
    );
  });

  it('should not dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:loaded', handler);

    dispatchMediaLoadedEvent(div, div, options);
    expect(handler).not.toBeCalled();
  });
});

// @vitest-environment jsdom
describe('dispatchExistingMediaLoadedInfoAsEvent', () => {
  it('should dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:loaded', handler);
    const info = createTestMediaLoadedInfo();

    dispatchExistingMediaLoadedInfoAsEvent(div, info);
    expect(handler).toBeCalledWith(
      expect.objectContaining({
        detail: info,
      }),
    );
  });
});

// @vitest-environment jsdom
describe('dispatchMediaUnloadedEvent', () => {
  it('should dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:unloaded', handler);

    dispatchMediaUnloadedEvent(div);
    expect(handler).toBeCalled();
  });
});

// @vitest-environment jsdom
describe('dispatchMediaVolumeChangeEvent', () => {
  it('should dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:volumechange', handler);

    dispatchMediaVolumeChangeEvent(div);
    expect(handler).toBeCalled();
  });
});

// @vitest-environment jsdom
describe('dispatchMediaPlayEvent', () => {
  it('should dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:play', handler);

    dispatchMediaPlayEvent(div);
    expect(handler).toBeCalled();
  });
});

// @vitest-environment jsdom
describe('dispatchMediaPauseEvent', () => {
  it('should dispatch', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.addEventListener('advanced-camera-card:media:pause', handler);

    dispatchMediaPauseEvent(div);
    expect(handler).toBeCalled();
  });
});

// @vitest-environment jsdom
describe('isValidMediaLoadedInfo', () => {
  it('should be valid with correct dimensions', () => {
    expect(
      isValidMediaLoadedInfo(createTestMediaLoadedInfo({ width: 100, height: 100 })),
    ).toBeTruthy();
  });
  it('should be invalid with unlikely dimensions', () => {
    expect(
      isValidMediaLoadedInfo(createTestMediaLoadedInfo({ width: 0, height: 0 })),
    ).toBeFalsy();
  });
});
