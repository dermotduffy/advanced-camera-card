import { describe, expect, it, vi } from 'vitest';

import { OffscreenVideo } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/offscreen-video';
import { FakeMediaStream, FakeMediaStreamTrack } from './test-utils';

// @vitest-environment jsdom
describe('OffscreenVideo', () => {
  it('should create the video from the factory on get', () => {
    const video = document.createElement('video');
    const offscreen = new OffscreenVideo(() => video);

    expect(offscreen.get()).toBe(video);
  });

  it('should reuse the same video across repeated get', () => {
    const create = vi.fn(() => document.createElement('video'));
    const offscreen = new OffscreenVideo(create);

    expect(offscreen.get()).toBe(offscreen.get());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should create a video with the default factory when none is injected', () => {
    const offscreen = new OffscreenVideo();

    expect(offscreen.get()).toBeInstanceOf(HTMLVideoElement);
  });

  it('should detach src and srcObject on clear', () => {
    const video = document.createElement('video');
    const offscreen = new OffscreenVideo(() => video);
    offscreen.get();
    video.src = 'data:video/mp4;base64,AAAA';
    video.srcObject = new FakeMediaStream([
      new FakeMediaStreamTrack('video'),
    ]).asMediaStream();

    offscreen.clear();

    expect(video.hasAttribute('src')).toBe(false);
    expect(video.srcObject).toBeNull();
  });

  it('should create a fresh video after clear', () => {
    const create = vi.fn(() => document.createElement('video'));
    const offscreen = new OffscreenVideo(create);
    offscreen.get();
    offscreen.clear();
    offscreen.get();

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('should tolerate clear when no video is held', () => {
    const offscreen = new OffscreenVideo(() => document.createElement('video'));

    expect(() => offscreen.clear()).not.toThrow();
  });
});
