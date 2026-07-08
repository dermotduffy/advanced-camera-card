import type JSMpeg from '@cycjimmy/jsmpeg-player';
import type { LitElement } from 'lit';

import type {
  FullscreenElement,
  LivenessCallback,
  MediaPlayerController,
  PIPElement,
  UnsubscribeCallback,
} from '../../types';
import { FrameStallWatchdog } from './frame-stall-watchdog';

export class JSMPEGMediaPlayerController implements MediaPlayerController {
  private _host: LitElement;
  private _getJSMPEGVideoElementCallback: () => JSMpeg.VideoElement | null;
  private _getCanvasElementCallback: () => HTMLCanvasElement | null;

  // Frames are fed by the provider via `notifyFrameDecoded` (JSMpeg's
  // per-decode callback), so the source needs no explicit start/stop -- the
  // watchdog's always-available defaults apply. Playback is expected whenever
  // not paused; a decode gap for the frame-stall window is then a stall.
  private _stallWatchdog = new FrameStallWatchdog({
    isPlaybackExpected: () => !this.isPaused(),
  });

  constructor(
    host: LitElement,
    _getJSMPEGVideoElementCallback: () => JSMpeg.VideoElement | null,
    _getCanvasElementCallback: () => HTMLCanvasElement | null,
  ) {
    this._host = host;
    this._getJSMPEGVideoElementCallback = _getJSMPEGVideoElementCallback;
    this._getCanvasElementCallback = _getCanvasElementCallback;
  }

  public subscribeLiveness(callback: LivenessCallback): UnsubscribeCallback {
    return this._stallWatchdog.subscribe(callback);
  }

  // Called by the provider on every decoded frame (JSMpeg's `onVideoDecode`).
  public notifyFrameDecoded(): void {
    this._stallWatchdog.notifyFrame();
  }

  public async play(): Promise<void> {
    await this._host.updateComplete;
    return this._getJSMPEGVideoElementCallback()?.play();
  }

  public async pause(): Promise<void> {
    await this._host.updateComplete;
    return this._getJSMPEGVideoElementCallback()?.stop();
  }

  public async mute(): Promise<void> {
    await this._host.updateComplete;
    const player = this._getJSMPEGVideoElementCallback()?.player;
    if (player) {
      player.volume = 0;
    }
  }

  public async unmute(): Promise<void> {
    await this._host.updateComplete;
    const player = this._getJSMPEGVideoElementCallback()?.player;
    if (player) {
      player.volume = 1;
    }
  }

  public isMuted(): boolean {
    const player = this._getJSMPEGVideoElementCallback()?.player;
    return player ? player.volume === 0 : true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async seek(_seconds: number): Promise<void> {
    // JSMPEG does not support seeking.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls: boolean): Promise<void> {
    // Not implemented.
  }

  public isPaused(): boolean {
    return this._getJSMPEGVideoElementCallback()?.player?.paused ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    await this._host.updateComplete;
    return this._getCanvasElementCallback()?.toDataURL('image/jpeg') ?? null;
  }

  public getFullscreenElement(): FullscreenElement | null {
    return this._getCanvasElementCallback() ?? null;
  }

  public getPIPElement(): PIPElement | null {
    // JSMpeg renders to a canvas, not a video element.
    return null;
  }
}
