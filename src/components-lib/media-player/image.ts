import type { LitElement } from 'lit';

import type {
  FullscreenElement,
  LivenessCallback,
  MediaPlayerController,
  PIPElement,
  PlaybackControl,
  UnsubscribeCallback,
} from '../../types';
import { screenshotImage } from '../../utils/screenshot';
import { FrameStallWatchdog } from './frame-stall-watchdog';

// A pausable update loop the controller owns (e.g. an image refreshed on a
// timer). Its presence makes the image player pausable.
export interface ImageUpdateControl {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

// Liveness for an image stream: each <img> `load` is a frame; a gap longer than
// the window while frames are expected is a stall. `stallWindowSeconds`
// defaults to the standard frame-stall window (suits a push-fed stream); a
// timer-refreshed image may set a different one, should be at least its refresh
// interval.
interface ImageLivenessOptions {
  isFrameExpected: () => boolean;
  stallWindowSeconds?: number;
}

// Obtaining a screenshot. Defaults to drawing the current <img>; an image
// refreshed on a timer can hand back its cached URL instead.
type ImageScreenshotProvider = () => Promise<string | null>;

interface ImageMediaPlayerControllerOptions {
  updateControl?: ImageUpdateControl;
  livenessOptions?: ImageLivenessOptions;
  screenshotProvider?: ImageScreenshotProvider;
}

// Image player composed from opt-in capabilities.
export class ImageMediaPlayerController implements MediaPlayerController {
  private _host: LitElement;
  private _getImageCallback: () => HTMLImageElement | null;
  private _screenshotProvider: ImageScreenshotProvider | null;

  private _stallWatchdog: FrameStallWatchdog | null = null;
  private _loadListener: (() => void) | null = null;

  public readonly playback?: PlaybackControl;
  public readonly subscribeLiveness?: (
    callback: LivenessCallback,
  ) => UnsubscribeCallback;

  constructor(
    host: LitElement,
    getImageCallback: () => HTMLImageElement | null,
    options?: ImageMediaPlayerControllerOptions,
  ) {
    this._host = host;
    this._getImageCallback = getImageCallback;
    this._screenshotProvider = options?.screenshotProvider ?? null;

    const updateControl = options?.updateControl;
    if (updateControl) {
      this.playback = {
        play: async (): Promise<void> => {
          await this._host.updateComplete;
          updateControl.start();
        },
        pause: async (): Promise<void> => {
          await this._host.updateComplete;
          updateControl.stop();
        },
        isPaused: (): boolean => !updateControl.isRunning(),
      };
    }

    const livenessOptions = options?.livenessOptions;
    if (livenessOptions) {
      const stallWatchdog = new FrameStallWatchdog({
        isPlaybackExpected: livenessOptions.isFrameExpected,
        stallAfterSeconds: livenessOptions.stallWindowSeconds,
        startSource: () => this._startFrameSource(),
        stopSource: () => this._stopFrameSource(),
      });
      this._stallWatchdog = stallWatchdog;
      this.subscribeLiveness = (callback): UnsubscribeCallback =>
        stallWatchdog.subscribe(callback);
    }
  }

  public async mute(): Promise<void> {
    // No audio.
  }

  public async unmute(): Promise<void> {
    // No audio.
  }

  public isMuted(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls?: boolean): Promise<void> {
    // No playback controls to show.
  }

  public async getScreenshotURL(): Promise<string | null> {
    await this._host.updateComplete;

    if (this._screenshotProvider) {
      return this._screenshotProvider();
    }
    const image = this._getImageCallback();
    return image ? screenshotImage(image) : null;
  }

  public getFullscreenElement(): FullscreenElement | null {
    return this._getImageCallback() ?? null;
  }

  public getPIPElement(): PIPElement | null {
    // Picture-in-picture is video-only.
    return null;
  }

  // The frame source is the image's `load` event: each newly displayed frame
  // fires it. With no image element there is nothing to observe, so the watchdog
  // is told there is no source and reports no stall.
  private _startFrameSource(): boolean {
    const image = this._getImageCallback();
    if (!image) {
      return false;
    }
    this._loadListener = (): void => {
      this._stallWatchdog?.notifyFrame();
    };
    image.addEventListener('load', this._loadListener);
    return true;
  }

  private _stopFrameSource(): void {
    const image = this._getImageCallback();
    if (image && this._loadListener) {
      image.removeEventListener('load', this._loadListener);
    }
    this._loadListener = null;
  }
}
