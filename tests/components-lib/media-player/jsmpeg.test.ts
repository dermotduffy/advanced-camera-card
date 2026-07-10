import type JSMpeg from '@cycjimmy/jsmpeg-player';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { FRAME_STALL_SECONDS } from '../../../src/components-lib/media-player/frame-stall-watchdog';
import { JSMPEGMediaPlayerController } from '../../../src/components-lib/media-player/jsmpeg';
import { createLitElement } from '../../test-utils';

// @vitest-environment jsdom
describe('JSMPEGMediaPlayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should play', async () => {
    const videoElement = mock<JSMpeg.VideoElement>();

    const controller = new JSMPEGMediaPlayerController(
      createLitElement(),
      () => videoElement,
      () => mock<HTMLCanvasElement>(),
    );

    await controller.playback.play();

    expect(videoElement.play).toBeCalled();
  });

  it('should pause', async () => {
    const videoElement = mock<JSMpeg.VideoElement>();

    const controller = new JSMPEGMediaPlayerController(
      createLitElement(),
      () => videoElement,
      () => mock<HTMLCanvasElement>(),
    );

    await controller.playback.pause();

    expect(videoElement.stop).toBeCalled();
  });

  describe('should mute', async () => {
    it('should mute with player', async () => {
      const videoElement = mock<JSMpeg.VideoElement>();
      videoElement.player = mock<JSMpeg.Player>();
      videoElement.player.volume = 1;

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );

      await controller.mute();

      expect(videoElement.player.volume).toBe(0);
    });

    it('should ignore calls without player', async () => {
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => null,
        () => mock<HTMLCanvasElement>(),
      );

      await controller.mute();

      // Currently no observable side effects.
    });
  });

  describe('should unmute', async () => {
    it('should mute with player', async () => {
      const videoElement = mock<JSMpeg.VideoElement>();
      videoElement.player = mock<JSMpeg.Player>();
      videoElement.player.volume = 0;

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );

      await controller.unmute();

      expect(videoElement.player.volume).toBe(1);
    });

    it('should ignore calls without player', async () => {
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => null,
        () => mock<HTMLCanvasElement>(),
      );

      await controller.unmute();

      // Currently no observable side effects.
    });
  });

  describe('should return muted state', () => {
    it('should return true when muted', () => {
      const videoElement = mock<JSMpeg.VideoElement>();
      videoElement.player = mock<JSMpeg.Player>();
      videoElement.player.volume = 0;

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );

      expect(controller.isMuted()).toBeTruthy();
    });

    it('should return false when not muted', () => {
      const videoElement = mock<JSMpeg.VideoElement>();
      videoElement.player = mock<JSMpeg.Player>();
      videoElement.player.volume = 1;

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );

      expect(controller.isMuted()).toBeFalsy();
    });

    it('should return true when no player', () => {
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => null,
        () => mock<HTMLCanvasElement>(),
      );

      expect(controller.isMuted()).toBeTruthy();
    });
  });

  it('should ignore set controls', async () => {
    const controller = new JSMPEGMediaPlayerController(
      createLitElement(),
      () => mock<JSMpeg.VideoElement>(),
      () => mock<HTMLCanvasElement>(),
    );
    await controller.setControls(true);

    // Currently no observable side effects.
  });

  describe('should return paused state', () => {
    it('should return true when paused', async () => {
      const videoElement = mock<JSMpeg.VideoElement>();
      videoElement.player = mock<JSMpeg.Player>();
      videoElement.player.paused = true;

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );

      expect(controller.playback.isPaused()).toBeTruthy();
    });

    it('should return false when not paused', async () => {
      const videoElement = mock<JSMpeg.VideoElement>();
      videoElement.player = mock<JSMpeg.Player>();
      videoElement.player.paused = false;

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );

      expect(controller.playback.isPaused()).toBeFalsy();
    });

    it('should return true when no video', () => {
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => null,
        () => mock<HTMLCanvasElement>(),
      );

      expect(controller.playback.isPaused()).toBeTruthy();
    });
  });

  describe('should get screenshot URL', async () => {
    it('should return screenshot URL with canvas', async () => {
      const url = 'data:image/png;base64,';
      const canvas = mock<HTMLCanvasElement>();
      canvas.toDataURL.mockReturnValue(url);

      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => mock<JSMpeg.VideoElement>(),
        () => canvas,
      );

      expect(await controller.getScreenshotURL()).toBe(url);
    });

    it('should return null without canvas', async () => {
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => mock<JSMpeg.VideoElement>(),
        () => null,
      );

      expect(await controller.getScreenshotURL()).toBeNull();
    });
  });

  describe('should get fullscreen element', async () => {
    it('should return fullscreen element with canvas', async () => {
      const canvas = mock<HTMLCanvasElement>();
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => mock<JSMpeg.VideoElement>(),
        () => canvas,
      );

      expect(await controller.getFullscreenElement()).toBe(canvas);
    });

    it('should return null without cancas', async () => {
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => mock<JSMpeg.VideoElement>(),
        () => null,
      );

      expect(controller.getFullscreenElement()).toBeNull();
    });
  });

  it('should return null for getPIPElement', () => {
    const controller = new JSMPEGMediaPlayerController(
      createLitElement(),
      () => mock<JSMpeg.VideoElement>(),
      () => null,
    );

    expect(controller.getPIPElement()).toBeNull();
  });

  describe('subscribeLiveness', () => {
    const STALL_MS = FRAME_STALL_SECONDS * 1000;

    const setup = (options?: { paused?: boolean; hasPlayer?: boolean }) => {
      let videoElement: JSMpeg.VideoElement | null = null;
      if (options?.hasPlayer !== false) {
        videoElement = mock<JSMpeg.VideoElement>();
        videoElement.player = mock<JSMpeg.Player>();
        videoElement.player.paused = options?.paused ?? false;
      }
      const controller = new JSMPEGMediaPlayerController(
        createLitElement(),
        () => videoElement,
        () => mock<HTMLCanvasElement>(),
      );
      return { controller };
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should report a stall when frame decodes stop', () => {
      const { controller } = setup();
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      controller.notifyFrameDecoded();
      vi.advanceTimersByTime(STALL_MS);

      // The first decoded frame confirms live, then decodes stop -> stall.
      expect(callback).toHaveBeenNthCalledWith(1, true);
      expect(callback).toHaveBeenNthCalledWith(2, false);
    });

    it('should not report a stall while paused', () => {
      const { controller } = setup({ paused: true });
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not report a stall without a player', () => {
      const { controller } = setup({ hasPlayer: false });
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
