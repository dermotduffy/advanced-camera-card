import type { LitElement, ReactiveController } from 'lit';

import type {
  FullscreenElement,
  LivenessCallback,
  MediaPlayerController,
  PIPElement,
  PlaybackControl,
  UnsubscribeCallback,
} from '../../types';
import { hideMediaControlsTemporarily, setControlsOnVideo } from '../../utils/controls';
import { screenshotVideo } from '../../utils/screenshot';
import { FrameStallWatchdog } from './frame-stall-watchdog';

export class VideoMediaPlayerController
  implements MediaPlayerController, ReactiveController
{
  private _host: LitElement;
  private _getVideoCallback: () => HTMLVideoElement | null;
  private _getControlsDefaultCallback: (() => boolean) | null;

  // The frame callback registration: the video it was made on and the handle to
  // cancel it with.
  private _frameCallback: { video: HTMLVideoElement; handle: number } | null = null;
  private _stallWatchdog = new FrameStallWatchdog({
    // Playback is expected unless the video is legitimately idle. Seeking /
    // ended is idle. A poster shown with no media loaded is a still-image
    // surface (e.g. an MJPEG/MP4 poster slideshow) that never presents video
    // frames, so no frame is ever expected -- distinct from a poster shown over
    // real media (a loading placeholder), which is still watched. A paused
    // video is idle only if it holds a current frame -- a genuine user pause;
    // paused with no current frame is not a real pause but a source
    // mid-reconnect or buffering (nothing to pause on), so playback is still
    // expected and a missing frame is a stall.
    isPlaybackExpected: () => {
      const video = this._getVideoCallback();
      if (!video || video.seeking || video.ended) {
        return false;
      }
      if (video.poster && !video.currentSrc && !video.srcObject) {
        return false;
      }
      return !video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
    },
    startSource: () => this._startFrameSource(),
    stopSource: () => this._stopFrameSource(),
  });

  constructor(
    host: LitElement,
    getVideoCallback: () => HTMLVideoElement | null,
    getControlsDefaultCallback?: () => boolean,
  ) {
    this._host = host;
    this._getVideoCallback = getVideoCallback;
    this._getControlsDefaultCallback = getControlsDefaultCallback ?? null;

    host.addController(this);
  }

  // A player can replace its video element (e.g. go2rtc rebuilding its player),
  // so the frame callback has to move with it. Left on the old element it would
  // be watching something detached that never presents another frame.
  //
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2726
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2718
  public hostUpdated(): void {
    if (!this._frameCallback) {
      return;
    }
    const video = this._getVideoCallback();
    if (!video || video === this._frameCallback.video) {
      return;
    }
    this._stopFrameSource();
    this._startFrameSource();
  }

  public readonly playback: PlaybackControl = {
    play: async (): Promise<void> => {
      await this._host.updateComplete;

      const video = this._getVideoCallback();
      if (!video?.play) {
        return;
      }

      // If the play call fails, and the media is not already muted, mute it
      // first and then try again. This works around some browsers that prevent
      // auto-play unless the video is muted.
      try {
        await video.play();
      } catch (err: unknown) {
        if ((err as Error).name === 'NotAllowedError' && !this.isMuted()) {
          await this.mute();
          try {
            await video.play();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            // Pass.
          }
        }
      }
    },

    pause: async (): Promise<void> => {
      await this._host.updateComplete;
      this._getVideoCallback()?.pause();
    },

    isPaused: (): boolean => {
      return this._getVideoCallback()?.paused ?? true;
    },
  };

  public async mute(): Promise<void> {
    await this._host.updateComplete;

    // The muted property is only for the initial muted state. Must explicitly
    // set the muted on the video player to make the change dynamic.
    const video = this._getVideoCallback();
    if (video) {
      video.muted = true;
    }
  }

  public async unmute(): Promise<void> {
    await this._host.updateComplete;

    const video = this._getVideoCallback();
    if (video) {
      video.muted = false;
    }
  }

  public isMuted(): boolean {
    return this._getVideoCallback()?.muted ?? true;
  }

  public async seek(seconds: number): Promise<void> {
    await this._host.updateComplete;

    const video = this._getVideoCallback();
    if (video) {
      hideMediaControlsTemporarily(video);
      video.currentTime = seconds;
    }
  }

  public async setControls(controls?: boolean): Promise<void> {
    await this._host.updateComplete;

    const video = this._getVideoCallback();
    const value = controls ?? this._getControlsDefaultCallback?.();
    if (video && value !== undefined) {
      setControlsOnVideo(video, value);
    }
  }

  public async getScreenshotURL(): Promise<string | null> {
    await this._host.updateComplete;

    const video = this._getVideoCallback();
    return video ? screenshotVideo(video) : null;
  }

  public getFullscreenElement(): FullscreenElement | null {
    return this._getVideoCallback() ?? null;
  }

  public getPIPElement(): PIPElement | null {
    return this._getVideoCallback() ?? null;
  }

  public subscribeLiveness(callback: LivenessCallback): UnsubscribeCallback {
    return this._stallWatchdog.subscribe(callback);
  }

  // The frame source is `requestVideoFrameCallback`, which is in every current
  // browser. On the rare one without it no frame is observed, so the watchdog is
  // told there is no source and reports no stall (liveness falls to other
  // detectors).
  private _startFrameSource(): boolean {
    const video = this._getVideoCallback();
    if (!video || !('requestVideoFrameCallback' in video)) {
      return false;
    }
    this._frameCallback = {
      video,
      handle: video.requestVideoFrameCallback(this._onVideoFrame),
    };
    return true;
  }

  private _stopFrameSource(): void {
    this._frameCallback?.video.cancelVideoFrameCallback(this._frameCallback.handle);
    this._frameCallback = null;
  }

  private _onVideoFrame = (): void => {
    this._stallWatchdog.notifyFrame();

    // Re-arm only if still watching: `notifyFrame`'s live notification may have
    // dropped the last subscriber, which stops the source and clears the
    // registration.
    const callback = this._frameCallback;
    if (!callback) {
      return;
    }

    callback.handle = callback.video.requestVideoFrameCallback(this._onVideoFrame);
  };
}
