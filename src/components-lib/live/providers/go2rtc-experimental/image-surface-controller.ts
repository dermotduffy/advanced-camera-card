import type { LitElement } from 'lit';

import { ImageMediaPlayerController } from '../../../media-player/image';
import type { ImageSurface } from './session-controller';

// Liveness: while frames are expected, a gap beyond the window is a stall.
// Omitted -> the surface reports no liveness. `stallWindowSeconds` defaults to
// the standard frame-stall window.
interface ImageSurfaceLivenessOptions {
  isFrameExpected: () => boolean;
  stallWindowSeconds?: number;
}

interface ImageSurfaceOptions {
  livenessOptions?: ImageSurfaceLivenessOptions;
}

// Presents a go2rtc MJPEG/MP4 stream as a sequence of frames on an <img>: each
// frame is shown via an object URL with the previous one revoked, and an
// ImageMediaPlayerController exposes it to the card as a media player. The
// renderer owns the <img> element; this owns what is shown on it.
export class ImageSurfaceController implements ImageSurface {
  private _getImageCallback: () => HTMLImageElement | null;
  private _mediaPlayerController: ImageMediaPlayerController;

  // Current frame.
  private _currentObjectURL: string | null = null;

  constructor(
    host: LitElement,
    getImageCallback: () => HTMLImageElement | null,
    options?: ImageSurfaceOptions,
  ) {
    this._getImageCallback = getImageCallback;
    this._mediaPlayerController = new ImageMediaPlayerController(
      host,
      getImageCallback,
      {
        livenessOptions: options?.livenessOptions,
      },
    );
  }

  public getElement(): HTMLImageElement | null {
    return this._getImageCallback();
  }

  public getMediaPlayer(): ImageMediaPlayerController {
    return this._mediaPlayerController;
  }

  // Show a new frame. The previous frame's object URL is revoked once the new
  // one is assigned: the previous frame is already decoded, so revoking its
  // source cannot blank the display.
  public showFrame(blob: Blob): void {
    const image = this._getImageCallback();
    if (!image) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const previousURL = this._currentObjectURL;
    this._currentObjectURL = url;

    image.src = url;

    if (previousURL) {
      URL.revokeObjectURL(previousURL);
    }
  }

  // Drop the current frame and its object URL (e.g. on a surface switch or
  // disconnect).
  public reset(): void {
    if (this._currentObjectURL) {
      URL.revokeObjectURL(this._currentObjectURL);
      this._currentObjectURL = null;
    }
    const image = this._getImageCallback();
    if (image) {
      image.removeAttribute('src');
    }
  }
}
