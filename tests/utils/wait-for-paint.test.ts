import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waitForPaint } from '../../src/utils/wait-for-paint';
import { flushPromises } from '../test-utils';

// @vitest-environment jsdom

// A video with a source of its own, whose frame callbacks the test runs.
const createVideo = (options?: {
  source?: 'src' | 'srcObject' | 'none';
  frameCallback?: boolean;
}): {
  video: HTMLVideoElement;
  presentFrame: () => void;
  cancelVideoFrameCallback: ReturnType<typeof vi.fn>;
} => {
  const video = document.createElement('video');
  const source = options?.source ?? 'src';
  if (source === 'src') {
    Object.defineProperty(video, 'currentSrc', { value: 'http://example.com/clip' });
  } else if (source === 'srcObject') {
    // A stream (e.g. WebRTC) gives no `currentSrc`.
    Object.defineProperty(video, 'srcObject', { value: {} });
  }

  const callbacks: VideoFrameRequestCallback[] = [];
  const cancelVideoFrameCallback = vi.fn(() => {
    callbacks.splice(0);
  });
  if (options?.frameCallback !== false) {
    Object.assign(video, {
      requestVideoFrameCallback: (callback: VideoFrameRequestCallback) =>
        callbacks.push(callback),
      cancelVideoFrameCallback,
    });
  }
  return {
    video,
    presentFrame: () =>
      callbacks
        .splice(0)
        .forEach((callback) => callback(0, {} as VideoFrameCallbackMetadata)),
    cancelVideoFrameCallback,
  };
};

describe('waitForPaint', () => {
  const animationFrames: FrameRequestCallback[] = [];
  const runAnimationFrame = (): void =>
    animationFrames.splice(0).forEach((callback) => callback(0));

  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      animationFrames.push(callback),
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      animationFrames.splice(0);
    });
  });

  afterEach(() => {
    animationFrames.splice(0);
    vi.restoreAllMocks();
  });

  const isResolved = async (promise: Promise<void>): Promise<boolean> => {
    let resolved = false;
    void promise.then(() => (resolved = true));
    await flushPromises();
    return resolved;
  };

  it('should resolve once the video presents a frame', async () => {
    const { video, presentFrame } = createVideo();
    const promise = waitForPaint(video, new AbortController().signal);

    runAnimationFrame();
    runAnimationFrame();
    expect(await isResolved(promise)).toBe(false);

    presentFrame();
    expect(await isResolved(promise)).toBe(true);
  });

  it('should resolve once a video playing a stream presents a frame', async () => {
    const { video, presentFrame } = createVideo({ source: 'srcObject' });
    const promise = waitForPaint(video, new AbortController().signal);

    runAnimationFrame();
    runAnimationFrame();
    expect(await isResolved(promise)).toBe(false);

    presentFrame();
    expect(await isResolved(promise)).toBe(true);
  });

  it('should stop waiting for a frame when aborted', async () => {
    const { video, presentFrame, cancelVideoFrameCallback } = createVideo();
    const controller = new AbortController();
    const promise = waitForPaint(video, controller.signal);

    controller.abort();
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(1);

    presentFrame();
    expect(await isResolved(promise)).toBe(false);
  });

  describe('should resolve after two animation frames', () => {
    it.each([
      ['without a video', null],
      ['for a video with only a poster', createVideo({ source: 'none' }).video],
      ['without requestVideoFrameCallback', createVideo({ frameCallback: false }).video],
    ])('%s', async (_name: string, video: HTMLVideoElement | null) => {
      const promise = waitForPaint(video, new AbortController().signal);

      runAnimationFrame();
      expect(await isResolved(promise)).toBe(false);

      runAnimationFrame();
      expect(await isResolved(promise)).toBe(true);
    });
  });

  it('should stop waiting for animation frames when aborted', async () => {
    const controller = new AbortController();
    const promise = waitForPaint(null, controller.signal);

    runAnimationFrame();
    controller.abort();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(animationFrames).toEqual([]);
    expect(await isResolved(promise)).toBe(false);
  });

  it('should not wait at all when already aborted', async () => {
    const { video } = createVideo();
    const controller = new AbortController();
    controller.abort();

    const promise = waitForPaint(video, controller.signal);

    runAnimationFrame();
    runAnimationFrame();
    expect(animationFrames).toEqual([]);
    expect(await isResolved(promise)).toBe(false);
  });
});
