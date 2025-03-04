import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AdvancedCameraCardHTMLVideoElement,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  hideMediaControlsTemporarily,
  setControlsOnVideo,
} from '../../src/utils/controls.js';

// @vitest-environment jsdom
describe('setControlsOnVideo', () => {
  it('should set controls', () => {
    const video = document.createElement('video');

    setControlsOnVideo(video, false);
    expect(video.controls).toBeFalsy();
  });

  it('should stop timer', () => {
    const video: AdvancedCameraCardHTMLVideoElement = document.createElement('video');
    hideMediaControlsTemporarily(video);

    expect(video._controlsHideTimer).toBeTruthy();
    expect(video._controlsHideTimer?.isRunning()).toBeTruthy();

    setControlsOnVideo(video, false);
    expect(video.controls).toBeFalsy();
    expect(video._controlsHideTimer).toBeFalsy();
  });
});

describe('hideMediaControlsTemporarily', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should set controls', () => {
    const video: AdvancedCameraCardHTMLVideoElement = document.createElement('video');
    video.controls = true;
    hideMediaControlsTemporarily(video);

    expect(video.controls).toBeFalsy();
    vi.runOnlyPendingTimers();

    expect(video.controls).toBeTruthy();
    expect(video._controlsHideTimer).toBeFalsy();
  });

  it('should add event listener that resets controls', () => {
    const video: AdvancedCameraCardHTMLVideoElement = document.createElement('video');
    video.controls = true;

    hideMediaControlsTemporarily(video);
    expect(video.controls).toBeFalsy();

    // After a new media starts to load, the controls should reset.
    video.dispatchEvent(new Event('loadstart'));
    expect(video.controls).toBeTruthy();

    // ... but only once, future loadstart events without subsequent calls to
    // hideMediaControlsTemporarily() should do nothing.
    video.controls = false;
    video.dispatchEvent(new Event('loadstart'));
    expect(video._controlsHideTimer).toBeFalsy();
  });
});

describe('constants', () => {
  it('MEDIA_LOAD_CONTROLS_HIDE_SECONDS', () => {
    expect(MEDIA_LOAD_CONTROLS_HIDE_SECONDS).toBe(2);
  });
});
