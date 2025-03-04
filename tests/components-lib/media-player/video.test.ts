import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { VideoMediaPlayerController } from '../../../src/components-lib/media-player/video';
import {
  hideMediaControlsTemporarily,
  setControlsOnVideo,
} from '../../../src/utils/controls';
import { screenshotVideo } from '../../../src/utils/screenshot';
import { createLitElement } from '../../test-utils';

vi.mock('../../../src/utils/controls.js');
vi.mock('../../../src/utils/screenshot.js');

class NotAllowedError extends Error {
  name = 'NotAllowedError';
}

// @vitest-environment jsdom
describe('VideoMediaPlayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('should play', () => {
    it('should play when no error', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockResolvedValue();

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.play();

      expect(video.play).toBeCalled();
    });

    it('should mute if not allowed to play and unmuted', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockRejectedValueOnce(new NotAllowedError()).mockResolvedValueOnce();
      video.muted = false;

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.play();

      expect(video.play).toBeCalledTimes(2);
      expect(video.muted).toBeTruthy();
    });

    it('should not mute if not allowed to play and already unmuted', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockRejectedValueOnce(new NotAllowedError());
      video.muted = true;

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.play();

      expect(video.play).toBeCalledTimes(1);
      expect(video.muted).toBeTruthy();
    });

    it('should ignore exception if subsequent play call throws', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockRejectedValue(new NotAllowedError());
      video.muted = false;

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.play();

      expect(video.play).toBeCalledTimes(2);
      expect(video.muted).toBeTruthy();
    });

    it('should ignore calls without a video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.play();

      // Currently no observable side effects.
    });
  });

  it('should pause', async () => {
    const video = mock<HTMLVideoElement>();
    const controller = new VideoMediaPlayerController(createLitElement(), () => video);

    await controller.pause();

    expect(video.pause).toBeCalled();
  });

  describe('should mute', async () => {
    it('should mute with video', async () => {
      const video = mock<HTMLVideoElement>();
      video.muted = false;
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.mute();

      expect(video.muted).toBeTruthy();
    });

    it('should ignore calls without a video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.mute();

      // Currently no observable side effects.
    });
  });

  describe('should unmute', async () => {
    it('should unmute with video', async () => {
      const video = mock<HTMLVideoElement>();
      video.muted = true;
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.unmute();

      expect(video.muted).toBeFalsy();
    });

    it('should ignore calls without a video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.unmute();

      // Currently no observable side effects.
    });
  });

  describe('should return muted state', () => {
    it('should return true when muted', () => {
      const video = mock<HTMLVideoElement>();
      video.muted = true;
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      expect(controller.isMuted()).toBeTruthy();
    });

    it('should return false when not muted', () => {
      const video = mock<HTMLVideoElement>();
      video.muted = false;
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      expect(controller.isMuted()).toBeFalsy();
    });

    it('should return true when no video', () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      expect(controller.isMuted()).toBeTruthy();
    });
  });

  describe('should seek', () => {
    it('should seek', async () => {
      const video = mock<HTMLVideoElement>();
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.seek(10);

      expect(hideMediaControlsTemporarily).toBeCalled();
      expect(video.currentTime).toBe(10);
    });

    it('should ignore calls without a video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.seek(10);

      // Currently no observable side effects.
    });
  });

  describe('should set controls', () => {
    it('should set controls', async () => {
      const video = mock<HTMLVideoElement>();
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.setControls(true);

      expect(setControlsOnVideo).toBeCalledWith(video, true);
    });

    it('should set controls to default', async () => {
      const video = mock<HTMLVideoElement>();
      const controller = new VideoMediaPlayerController(
        createLitElement(),
        () => video,
        () => true,
      );

      await controller.setControls();

      expect(setControlsOnVideo).toBeCalledWith(video, true);
    });

    it('should ignore calls without a default or value', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.setControls(true);

      expect(setControlsOnVideo).not.toBeCalled();
    });
  });

  describe('should return paused state', () => {
    it('should return true when paused', async () => {
      const video = mock<HTMLVideoElement>();
      Object.defineProperty(video, 'paused', { value: true });

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.pause();

      expect(controller.isPaused()).toBeTruthy();
    });

    it('should return false when not paused', async () => {
      const video = mock<HTMLVideoElement>();
      Object.defineProperty(video, 'paused', { value: false });

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.pause();

      expect(controller.isPaused()).toBeFalsy();
    });

    it('should return true when no video', () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      expect(controller.isPaused()).toBeTruthy();
    });
  });

  describe('should get screenshot URL', async () => {
    it('should return screenshot URL with video', async () => {
      const url = 'data:image/png;base64,';
      vi.mocked(screenshotVideo).mockReturnValue(url);

      const video = mock<HTMLVideoElement>();

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      expect(await controller.getScreenshotURL()).toBe(url);
    });

    it('should return null without video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      expect(await controller.getScreenshotURL()).toBeNull();
    });
  });

  describe('should get fullscreen element', async () => {
    it('should return fullscreen element with video', async () => {
      const video = mock<HTMLVideoElement>();

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      expect(await controller.getFullscreenElement()).toBe(video);
    });

    it('should return null without video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      expect(controller.getFullscreenElement()).toBeNull();
    });
  });
});
