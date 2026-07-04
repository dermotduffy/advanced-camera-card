import type { LitElement } from 'lit';

import type {
  FullscreenElement,
  LivenessCallback,
  MediaPlayerController,
  PIPElement,
  UnsubscribeCallback,
} from '../../types';
import { hideMediaControlsTemporarily, setControlsOnVideo } from '../../utils/controls';
import { screenshotVideo } from '../../utils/screenshot';
import { FrameStallWatchdog } from './frame-stall-watchdog';

export class VideoMediaPlayerController implements MediaPlayerController {
  private _host: LitElement;
  private _getVideoCallback: () => HTMLVideoElement | null;
  private _getControlsDefaultCallback: (() => boolean) | null;

  private _rvfcHandle: number | null = null;
  private _stallWatchdog = new FrameStallWatchdog({
    shouldReportStall: () => {
      const video = this._getVideoCallback();

      // Only a video that actually holds current media can be frozen. Paused /
      // seeking / ended is legitimate idling; a sourceless or still-loading
      // video (readyState < HAVE_CURRENT_DATA, e.g. mid in-place source swap /
      // reconnect) has no frame to freeze on, and never-started playback is the
      // initial-load timeout's concern.
      return (
        !!video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !video.paused &&
        !video.seeking &&
        !video.ended
      );
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
  }

  public async play(): Promise<void> {
    await this._host.updateComplete;

    const video = this._getVideoCallback();
    if (!video?.play) {
      return;
    }

    // If the play call fails, and the media is not already muted, mute it first
    // and then try again. This works around some browsers that prevent
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
  }

  public async pause(): Promise<void> {
    await this._host.updateComplete;
    this._getVideoCallback()?.pause();
  }

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

  public isPaused(): boolean {
    return this._getVideoCallback()?.paused ?? true;
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
    this._rvfcHandle = video.requestVideoFrameCallback(this._onVideoFrame);
    return true;
  }

  private _stopFrameSource(): void {
    const video = this._getVideoCallback();
    if (video && this._rvfcHandle !== null) {
      video.cancelVideoFrameCallback(this._rvfcHandle);
    }
    this._rvfcHandle = null;
  }

  private _onVideoFrame = (): void => {
    this._stallWatchdog.notifyFrame();

    // Re-arm only if still watching: `notifyFrame`'s live notification may have
    // dropped the last subscriber, which stops the source and nulls the handle.
    if (this._rvfcHandle === null) {
      return;
    }
    const video = this._getVideoCallback();
    if (video) {
      this._rvfcHandle = video.requestVideoFrameCallback(this._onVideoFrame);
    }
  };
}
