import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { FRAME_STALL_SECONDS } from '../../../src/components-lib/media-player/frame-stall-watchdog';
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

const STALL_MS = FRAME_STALL_SECONDS * 1000;

// A real jsdom <video> (so `'requestVideoFrameCallback' in video` is genuinely
// false unless we add it) with controllable properties and a driveable frame
// callback.
const createVideo = (options?: {
  readyState?: number;
  paused?: boolean;
  seeking?: boolean;
  ended?: boolean;
  rvfc?: boolean;
  poster?: string;
  currentSrc?: string;
  srcObject?: MediaStream | null;
}): {
  video: HTMLVideoElement;
  deliverFrame: () => void;
  cancel: ReturnType<typeof vi.fn>;
} => {
  const video = document.createElement('video');
  const define = (prop: string, value: unknown): void => {
    Object.defineProperty(video, prop, { value, configurable: true });
  };
  define('readyState', options?.readyState ?? HTMLMediaElement.HAVE_CURRENT_DATA);
  define('paused', options?.paused ?? false);
  define('seeking', options?.seeking ?? false);
  define('ended', options?.ended ?? false);
  define('poster', options?.poster ?? '');
  define('currentSrc', options?.currentSrc ?? '');
  define('srcObject', options?.srcObject ?? null);

  let frameCallback: (() => void) | null = null;
  const cancel = vi.fn();
  if (options?.rvfc !== false) {
    let handle = 0;
    define(
      'requestVideoFrameCallback',
      vi.fn((cb: () => void) => {
        frameCallback = cb;
        return ++handle;
      }),
    );
    define('cancelVideoFrameCallback', cancel);
  }

  return { video, deliverFrame: () => frameCallback?.(), cancel };
};

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

      await controller.playback.play();

      expect(video.play).toHaveBeenCalled();
    });

    it('should mute if not allowed to play and unmuted', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockRejectedValueOnce(new NotAllowedError()).mockResolvedValueOnce();
      video.muted = false;

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.playback.play();

      expect(video.play).toHaveBeenCalledTimes(2);
      expect(video.muted).toBeTruthy();
    });

    it('should not mute if not allowed to play and already unmuted', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockRejectedValueOnce(new NotAllowedError());
      video.muted = true;

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.playback.play();

      expect(video.play).toHaveBeenCalledTimes(1);
      expect(video.muted).toBeTruthy();
    });

    it('should ignore exception if subsequent play call throws', async () => {
      const video = mock<HTMLVideoElement>();
      video.play.mockRejectedValue(new NotAllowedError());
      video.muted = false;

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.playback.play();

      expect(video.play).toHaveBeenCalledTimes(2);
      expect(video.muted).toBeTruthy();
    });

    it('should ignore calls without a video', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.playback.play();

      // Currently no observable side effects.
    });
  });

  it('should pause', async () => {
    const video = mock<HTMLVideoElement>();
    const controller = new VideoMediaPlayerController(createLitElement(), () => video);

    await controller.playback.pause();

    expect(video.pause).toHaveBeenCalled();
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

      expect(hideMediaControlsTemporarily).toHaveBeenCalled();
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

      expect(setControlsOnVideo).toHaveBeenCalledWith(video, true);
    });

    it('should set controls to default', async () => {
      const video = mock<HTMLVideoElement>();
      const controller = new VideoMediaPlayerController(
        createLitElement(),
        () => video,
        () => true,
      );

      await controller.setControls();

      expect(setControlsOnVideo).toHaveBeenCalledWith(video, true);
    });

    it('should ignore calls without a default or value', async () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      await controller.setControls(true);

      expect(setControlsOnVideo).not.toHaveBeenCalled();
    });
  });

  describe('should return paused state', () => {
    it('should return true when paused', async () => {
      const video = mock<HTMLVideoElement>();
      Object.defineProperty(video, 'paused', { value: true });

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.playback.pause();

      expect(controller.playback.isPaused()).toBeTruthy();
    });

    it('should return false when not paused', async () => {
      const video = mock<HTMLVideoElement>();
      Object.defineProperty(video, 'paused', { value: false });

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      await controller.playback.pause();

      expect(controller.playback.isPaused()).toBeFalsy();
    });

    it('should return true when no video', () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      expect(controller.playback.isPaused()).toBeTruthy();
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

  describe('should get PIP element', () => {
    it('should return video element when available', () => {
      const video = mock<HTMLVideoElement>();

      const controller = new VideoMediaPlayerController(createLitElement(), () => video);

      expect(controller.getPIPElement()).toBe(video);
    });

    it('should return null without video', () => {
      const controller = new VideoMediaPlayerController(createLitElement(), () => null);

      expect(controller.getPIPElement()).toBeNull();
    });
  });

  describe('subscribeLiveness', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should report a stall when frames stop arriving', () => {
      const { video, deliverFrame } = createVideo();
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      deliverFrame();
      vi.advanceTimersByTime(STALL_MS);

      // The first frame confirms live, then no further frame arrives -> stall.
      expect(callback).toHaveBeenNthCalledWith(1, true);
      expect(callback).toHaveBeenNthCalledWith(2, false);
    });

    it('should not report a stall while a paused video still holds a frame', () => {
      // A genuine user pause: paused with a current frame is idle, never
      // reported -- not even after the stall window.
      const { video } = createVideo({ paused: true });
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should report a video stuck paused with no current frame', () => {
      // The observed go2rtc failure: its internal reconnect leaves the <video>
      // paused at readyState 0 (spinning). That is not a genuine pause -- there
      // is no frame to pause on -- so playback is still expected and a missing
      // frame is a stall.
      const { video } = createVideo({
        paused: true,
        readyState: HTMLMediaElement.HAVE_NOTHING,
      });
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should not report a stall for a poster shown with no media loaded', () => {
      // A still-image surface (an MJPEG/MP4 poster slideshow): a poster with no
      // media never presents video frames, so a missing frame is not a stall.
      const { video } = createVideo({
        poster: 'data:image/jpeg;base64,xxx',
        paused: true,
        readyState: HTMLMediaElement.HAVE_NOTHING,
      });
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should still watch a poster shown over media loaded from a src', () => {
      // A loading placeholder over real media (e.g. an HLS player): playback is
      // expected, so a missing frame is still a stall.
      const { video } = createVideo({
        poster: 'data:image/jpeg;base64,xxx',
        currentSrc: 'blob:http://localhost/stream',
        paused: true,
        readyState: HTMLMediaElement.HAVE_NOTHING,
      });
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should still watch a poster shown over a media stream', () => {
      // A loading placeholder over a live stream (e.g. an HA WebRTC player).
      const { video } = createVideo({
        poster: 'data:image/jpeg;base64,xxx',
        srcObject: mock<MediaStream>(),
        paused: true,
        readyState: HTMLMediaElement.HAVE_NOTHING,
      });
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should report no stall when requestVideoFrameCallback is unavailable', () => {
      const { video } = createVideo({ rvfc: false });
      expect('requestVideoFrameCallback' in video).toBe(false);
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should stop watching and cancel the frame callback on unsubscribe', () => {
      const { video, cancel } = createVideo();
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      const callback = vi.fn();

      const unsubscribe = controller.subscribeLiveness(callback);
      unsubscribe();
      vi.advanceTimersByTime(STALL_MS);

      expect(cancel).toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not re-arm when the last subscriber unsubscribes during recovery', () => {
      const { video, deliverFrame, cancel } = createVideo();
      const controller = new VideoMediaPlayerController(createLitElement(), () => video);
      let unsubscribe: () => void = () => {};
      const callback = vi.fn((isLive: boolean) => {
        if (isLive) {
          unsubscribe();
        }
      });

      unsubscribe = controller.subscribeLiveness(callback);

      // Stall -> callback(false)
      vi.advanceTimersByTime(STALL_MS);

      // Recovery -> callback(true) -> unsubscribe -> source stopped
      deliverFrame();

      expect(cancel).toHaveBeenCalled();
    });

    it('should skip re-arming and report no stall when the video is gone between frames', () => {
      const { video, deliverFrame } = createVideo();
      let currentVideo: HTMLVideoElement | null = video;
      const controller = new VideoMediaPlayerController(
        createLitElement(),
        () => currentVideo,
      );
      const callback = vi.fn();

      controller.subscribeLiveness(callback);
      deliverFrame();

      // Remove video
      currentVideo = null;

      // Re-arm skipped: no video
      deliverFrame();

      // The first frame reported live; the stall timer then fires with no
      // video, so no stall is ever reported.
      vi.advanceTimersByTime(STALL_MS);
      expect(callback).not.toHaveBeenCalledWith(false);
    });

    it('should cancel nothing on unsubscribe when the video is already gone', () => {
      const { video, cancel } = createVideo();
      let currentVideo: HTMLVideoElement | null = video;
      const controller = new VideoMediaPlayerController(
        createLitElement(),
        () => currentVideo,
      );

      const unsubscribe = controller.subscribeLiveness(vi.fn());
      currentVideo = null;
      unsubscribe();

      expect(cancel).not.toHaveBeenCalled();
    });
  });
});
