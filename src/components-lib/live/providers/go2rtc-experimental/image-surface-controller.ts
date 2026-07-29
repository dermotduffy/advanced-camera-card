import type { LitElement } from 'lit';

import { Generation } from '../../../../utils/concurrency/generation';
import { LatestValueRunner } from '../../../../utils/concurrency/latest-value-runner';
import { ImageMediaPlayerController } from '../../../media-player/image';
import { OffscreenImage } from './offscreen-image';
import type { ImageSurface } from './session-controller';

// Liveness: while frames are expected, a gap beyond the window is a stall.
// Omitted -> the surface reports no liveness. `getStallAfterSeconds` defaults to
// the standard frame-stall window.
interface ImageSurfaceLivenessOptions {
  isFrameExpected: () => boolean;
  getStallAfterSeconds?: () => number;
}

interface ImageSurfaceOptions {
  livenessOptions?: ImageSurfaceLivenessOptions;

  // Factory for the detached image loader used to decode a frame.
  createImage?: () => HTMLImageElement;
}

// Presents a go2rtc MJPEG/MP4 stream as a sequence of frames on an <img>: each
// frame is decoded off-DOM, then shown via an object URL (the previous one
// revoked), and an ImageMediaPlayerController exposes it to the card as a media
// player. The renderer owns the <img> element; this owns what is shown on it.
export class ImageSurfaceController implements ImageSurface {
  private _getImageCallback: () => HTMLImageElement | null;
  private _mediaPlayerController: ImageMediaPlayerController;

  // An off-screen <img> used to decode each frame before it is shown on the
  // visible element (reused: only one frame decodes at a time).
  private _decoder: OffscreenImage;

  // Current frame's object URL.
  private _currentObjectURL: string | null = null;

  // Invalidated by reset() so a frame whose decode was still in flight when the
  // surface was switched or torn down does not paint a stale frame afterwards.
  private _generation = new Generation();

  // Frames can arrive faster than the browser decodes one. Present at most one
  // at a time and keep only the newest frame while busy, so the display
  // converges on the latest without unbounded decode work.
  private _frameRunner = new LatestValueRunner<Blob>((frame) =>
    this._presentFrame(frame),
  );

  constructor(
    host: LitElement,
    getImageCallback: () => HTMLImageElement | null,
    options?: ImageSurfaceOptions,
  ) {
    this._getImageCallback = getImageCallback;
    this._decoder = new OffscreenImage(options?.createImage);
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

  // Show a new frame. A newer frame supersedes any still waiting to show; the
  // returned promise resolves once *a* frame has been presented.
  public showFrame(blob: Blob): Promise<void> {
    return this._frameRunner.submit(blob);
  }

  private async _presentFrame(blob: Blob): Promise<void> {
    const image = this._getImageCallback();

    // Drop frames for a detached element (e.g. a surface superseded
    // mid-teardown) so a retired surface never paints.
    if (!image || !image.isConnected) {
      return;
    }

    const generation = this._generation.current();
    const url = URL.createObjectURL(blob);

    // Decode the frame on the off-screen loader before showing it. Assigning an
    // undecoded object URL to the visible <img> makes WebKit repaint the
    // element empty until the decode completes, flashing the media background
    // between frames; decoding first lets the swap paint from cache (as it's
    // the same url) with no empty state.
    const decoder = this._decoder.get();
    decoder.src = url;
    try {
      await decoder.decode();
    } catch {
      // An undecodable frame is not fatal: drop it and keep the current one.
      URL.revokeObjectURL(url);
      return;
    }

    // The surface may have been switched (reset) or detached during the decode;
    // painting now would show a stale frame on a retired surface.
    if (!this._generation.isCurrent(generation) || !image.isConnected) {
      URL.revokeObjectURL(url);
      return;
    }

    image.src = url;

    const previousURL = this._currentObjectURL;
    this._currentObjectURL = url;
    if (previousURL) {
      URL.revokeObjectURL(previousURL);
    }
  }

  // Drop the current frame and its object URL (e.g. on a surface switch or
  // disconnect).
  public reset(): void {
    // Invalidate any frame still decoding so it cannot paint onto a surface
    // that has since been switched or disconnected.
    this._generation.invalidate();

    // Drop any frame still waiting to show, for the same reason.
    this._frameRunner.clear();

    if (this._currentObjectURL) {
      URL.revokeObjectURL(this._currentObjectURL);
      this._currentObjectURL = null;
    }
    this._decoder.clear();

    const image = this._getImageCallback();
    if (image) {
      image.removeAttribute('src');
    }
  }
}
