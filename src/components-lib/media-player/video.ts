import { LitElement } from 'lit';
import { FullscreenElement, MediaPlayerController } from '../../types';
import { hideMediaControlsTemporarily, setControlsOnVideo } from '../../utils/controls';
import { screenshotVideo } from '../../utils/screenshot';

export class VideoMediaPlayerController implements MediaPlayerController {
  private _host: LitElement;
  private _getVideoCallback: () => HTMLVideoElement | null;
  private _getControlsDefaultCallback: (() => boolean) | null;

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
        } catch (_) {
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
}
