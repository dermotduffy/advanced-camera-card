import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  ImageMediaPlayerController,
  type ImageUpdateControl,
} from '../../../src/components-lib/media-player/image';
import { screenshotImage } from '../../../src/utils/screenshot';
import { createLitElement } from '../../test-utils';

vi.mock('../../../src/utils/screenshot.js');

const STALL_SECONDS = 10;
const STALL_MS = STALL_SECONDS * 1000;

const createImageMediaPlayerWithLiveness = (
  isFrameExpected: () => boolean,
  getImageCallback: () => HTMLImageElement | null,
  stallAfterSeconds = STALL_SECONDS,
): ImageMediaPlayerController =>
  new ImageMediaPlayerController(createLitElement(), getImageCallback, {
    livenessOptions: { isFrameExpected, getStallAfterSeconds: () => stallAfterSeconds },
  });

// @vitest-environment jsdom
describe('ImageMediaPlayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ignore mute', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.mute();

    // No audio, so nothing to observe.
  });

  it('should ignore unmute', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.unmute();

    // No audio, so nothing to observe.
  });

  it('should always report muted', () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    expect(controller.isMuted()).toBeTruthy();
  });

  it('should ignore set controls', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.setControls(true);

    // No playback controls, so nothing to observe.
  });

  describe('should get screenshot URL', () => {
    it('should return screenshot URL with image', async () => {
      const url = 'data:image/png;base64,';
      vi.mocked(screenshotImage).mockReturnValue(url);

      const image = mock<HTMLImageElement>();

      const controller = new ImageMediaPlayerController(createLitElement(), () => image);

      expect(await controller.getScreenshotURL()).toBe(url);
    });

    it('should return null without image', async () => {
      const controller = new ImageMediaPlayerController(createLitElement(), () => null);

      expect(await controller.getScreenshotURL()).toBeNull();
    });

    it('should use the screenshot provider when given', async () => {
      const url = 'data:image/png;base64,provider';
      const image = mock<HTMLImageElement>();
      const controller = new ImageMediaPlayerController(
        createLitElement(),
        () => image,
        { screenshotProvider: async () => url },
      );

      expect(await controller.getScreenshotURL()).toBe(url);
      expect(screenshotImage).not.toHaveBeenCalled();
    });
  });

  describe('should get fullscreen element', () => {
    it('should return fullscreen element with image', () => {
      const image = mock<HTMLImageElement>();

      const controller = new ImageMediaPlayerController(createLitElement(), () => image);

      expect(controller.getFullscreenElement()).toBe(image);
    });

    it('should return null without image', () => {
      const controller = new ImageMediaPlayerController(createLitElement(), () => null);

      expect(controller.getFullscreenElement()).toBeNull();
    });
  });

  it('should return null for getPIPElement', () => {
    const controller = new ImageMediaPlayerController(createLitElement(), () => null);

    expect(controller.getPIPElement()).toBeNull();
  });

  describe('playback', () => {
    it('should be absent without an update control', () => {
      const controller = new ImageMediaPlayerController(createLitElement(), () =>
        mock<HTMLImageElement>(),
      );

      expect(controller.playback).toBeUndefined();
    });

    it('should start the update loop on play', async () => {
      const updateControl = mock<ImageUpdateControl>();
      const controller = new ImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        { updateControl },
      );

      await controller.playback?.play();

      expect(updateControl.start).toHaveBeenCalled();
    });

    it('should stop the update loop on pause', async () => {
      const updateControl = mock<ImageUpdateControl>();
      const controller = new ImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        { updateControl },
      );

      await controller.playback?.pause();

      expect(updateControl.stop).toHaveBeenCalled();
    });

    it('should report paused when the update loop is not running', () => {
      const updateControl = mock<ImageUpdateControl>();
      updateControl.isRunning.mockReturnValue(false);
      const controller = new ImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        { updateControl },
      );

      expect(controller.playback?.isPaused()).toBeTruthy();
    });

    it('should report unpaused when the update loop is running', () => {
      const updateControl = mock<ImageUpdateControl>();
      updateControl.isRunning.mockReturnValue(true);
      const controller = new ImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        { updateControl },
      );

      expect(controller.playback?.isPaused()).toBeFalsy();
    });
  });

  describe('subscribeLiveness', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should be absent without liveness options', () => {
      const controller = new ImageMediaPlayerController(createLitElement(), () =>
        document.createElement('img'),
      );

      expect(controller.subscribeLiveness).toBeUndefined();
    });

    it('should report a stall when frames stop arriving', () => {
      const image = document.createElement('img');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      image.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenNthCalledWith(1, true);
      expect(callback).toHaveBeenNthCalledWith(2, false);
    });

    it('should stay live while frames keep arriving', () => {
      const image = document.createElement('img');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      image.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(STALL_MS - 1000);
      image.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(STALL_MS - 1000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should report no stall while frames are not expected', () => {
      const image = document.createElement('img');
      const controller = createImageMediaPlayerWithLiveness(
        () => false,
        () => image,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should report no stall without an image element', () => {
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => null,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should stop watching on unsubscribe', () => {
      const image = document.createElement('img');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      const unsubscribe = subscribe(callback);
      image.dispatchEvent(new Event('load'));
      unsubscribe();
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should tolerate the image going away before unsubscribe', () => {
      let image: HTMLImageElement | null = document.createElement('img');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      const unsubscribe = subscribe(callback);
      image.dispatchEvent(new Event('load'));
      image = null;
      unsubscribe();
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not report a stall while a replacement image keeps loading', () => {
      const original = document.createElement('img');
      const replacement = document.createElement('img');
      let current = original;
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => current,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      original.dispatchEvent(new Event('load'));

      current = replacement;
      controller.hostUpdated();

      // Twice the stall window, with the replacement loading throughout.
      for (let i = 0; i < 2 * STALL_SECONDS; i++) {
        replacement.dispatchEvent(new Event('load'));
        vi.advanceTimersByTime(1000);
      }

      expect(callback).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('should not give a replacement longer than the stall window', () => {
      const original = document.createElement('img');
      const replacement = document.createElement('img');
      let current = original;
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => current,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      original.dispatchEvent(new Event('load'));

      current = replacement;
      controller.hostUpdated();

      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenNthCalledWith(1, true);
      expect(callback).toHaveBeenNthCalledWith(2, false);
    });

    it('should stop watching an image the host has replaced', () => {
      const original = document.createElement('img');
      const replacement = document.createElement('img');
      let current = original;
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => current,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      current = replacement;
      controller.hostUpdated();

      // The abandoned image is no longer listened to, so its loads say nothing.
      original.dispatchEvent(new Event('load'));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should keep watching the same image when a render changes nothing', () => {
      const image = document.createElement('img');
      const addEventListener = vi.spyOn(image, 'addEventListener');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);

      subscribe(vi.fn());
      controller.hostUpdated();
      controller.hostUpdated();

      expect(addEventListener).toHaveBeenCalledOnce();
    });

    it('should keep watching the old image when a render offers no replacement', () => {
      const image = document.createElement('img');
      const removeEventListener = vi.spyOn(image, 'removeEventListener');
      let current: HTMLImageElement | null = image;
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => current,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);

      subscribe(vi.fn());
      current = null;
      controller.hostUpdated();

      expect(removeEventListener).not.toHaveBeenCalled();
    });

    it('should ignore a render before anything is being watched', () => {
      const image = document.createElement('img');
      const addEventListener = vi.spyOn(image, 'addEventListener');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
      );

      controller.hostUpdated();

      expect(addEventListener).not.toHaveBeenCalled();
    });

    it('should stop watching the replaced image, not its replacement', () => {
      const original = document.createElement('img');
      const replacement = document.createElement('img');
      const removeOriginal = vi.spyOn(original, 'removeEventListener');
      const removeReplacement = vi.spyOn(replacement, 'removeEventListener');
      let current = original;
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => current,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);

      const unsubscribe = subscribe(vi.fn());
      current = replacement;
      unsubscribe();

      expect(removeOriginal).toHaveBeenCalled();
      expect(removeReplacement).not.toHaveBeenCalled();
    });

    it('should register itself with its host', () => {
      const host = createLitElement();
      new ImageMediaPlayerController(host, () => null);

      expect(host.addController).toHaveBeenCalled();
    });

    it('should honor a custom stall window', () => {
      const shortSeconds = 3;
      const image = document.createElement('img');
      const controller = createImageMediaPlayerWithLiveness(
        () => true,
        () => image,
        shortSeconds,
      );
      const subscribe = controller.subscribeLiveness;
      assert(subscribe);
      const callback = vi.fn();

      subscribe(callback);
      image.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(shortSeconds * 1000);

      expect(callback).toHaveBeenNthCalledWith(1, true);
      expect(callback).toHaveBeenNthCalledWith(2, false);
    });
  });
});
