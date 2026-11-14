import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { CameraConfig } from '../../config/schema/cameras';
import type { ImageBaseConfig } from '../../config/schema/common/image';
import type { MediaPlayerController } from '../../types';
import {
  getLastFrameKey,
  lastFrameStore,
  type LastFrameStore,
} from '../../utils/last-frame-store';

/**
 * A camera's image configuration when it is in mode `last_frame` (its stream
 * is then captured for its loading image), otherwise null.
 */
export const getLastFrameImageConfig = (
  config: ImageBaseConfig | null | undefined,
): ImageBaseConfig | null => (config?.mode === 'last_frame' ? config : null);

interface LastFrameControllerOptions {
  getCameraID: () => string | null;
  // The camera's configuration: with the ID, the key its frame is kept under.
  getCameraConfig: () => CameraConfig | null;
  // The camera's image configuration in mode `last_frame`, or null: capturing
  // happens only with one.
  getImageConfig: () => ImageBaseConfig | null;
  getMediaPlayerController: () => MediaPlayerController | null;
  // Whether the host has the stream loaded (or is about to): when this turns
  // false the stream is unloaded at the coming render.
  isLoaded: () => boolean;
  // Whether the stream is delivering media: a stalled stream is not captured.
  isLive: () => boolean;
}

/**
 * Captures a live provider's stream for image mode `last_frame`: at once,
 * while the video still shows, when it is about to go -- the page is hidden,
 * the host leaves the page (e.g. another dashboard view), or the host unloads
 * the stream. The drawn frame itself (`getDrawnFrame`) is kept for the host to
 * show at once, until it clears it: an encoded frame would first have to be
 * decoded, and the page may already be paused by then.
 */
export class LastFrameController implements ReactiveController {
  private _options: LastFrameControllerOptions;
  private _store: LastFrameStore;
  private _host: ReactiveControllerHost;
  private _listening = false;
  private _drawnFrame: HTMLCanvasElement | null = null;
  private _wasLoaded = false;

  // The player as of the last host update: on disconnect the host's own
  // record of it may already be cleared.
  private _player: MediaPlayerController | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: LastFrameControllerOptions,
    store: LastFrameStore = lastFrameStore,
  ) {
    this._options = options;
    this._store = store;
    this._host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    this._startOrStop();
  }

  public hostUpdate(): void {
    // Runs before the render that would remove an unloaded stream.
    const loaded = this._options.isLoaded();
    if (this._wasLoaded && !loaded) {
      this._capture();
    }
    this._wasLoaded = loaded;
  }

  public hostUpdated(): void {
    this._player = this._options.getMediaPlayerController();
    this._startOrStop();
  }

  public hostDisconnected(): void {
    this._capture();
    this._stop();
    this._player = null;
    this._wasLoaded = false;
  }

  // The canvas of the last capture, until the host clears it.
  public getDrawnFrame(): HTMLCanvasElement | null {
    return this._drawnFrame;
  }

  public clearDrawnFrame(): void {
    this._drawnFrame = null;
  }

  /**
   * Capture the frame shown now: taken at once (the player may be going),
   * stored once it is encoded.
   */
  private _capture(): void {
    const cameraID = this._options.getCameraID();
    const imageConfig = this._options.getImageConfig();
    if (!cameraID || !imageConfig) {
      return;
    }

    const player = this._options.getMediaPlayerController() ?? this._player;
    const frame = this._options.isLive()
      ? player?.captureCurrentFrame?.() ?? null
      : null;
    const capturedAt = new Date();

    if (frame) {
      this._drawnFrame = frame.canvas;
      this._host.requestUpdate();
    }

    void frame?.url.then((url) => {
      // Only a captured picture: a player that answers with a URL (e.g. a
      // camera snapshot) would be fetched again, with an expired token, later.
      if (url?.startsWith('data:image/')) {
        this._store.set(
          getLastFrameKey(cameraID, this._options.getCameraConfig()),
          { url, capturedAt },
          imageConfig.last_frame.max_age_seconds,
        );
      }
    });
  }

  private _startOrStop(): void {
    const imageConfig = this._options.getImageConfig();
    if (imageConfig) {
      this._start();
    } else {
      this._stop();
    }
  }

  private _start(): void {
    if (!this._listening) {
      this._listening = true;
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  private _stop(): void {
    if (this._listening) {
      this._listening = false;
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  private _visibilityHandler = (): void => {
    if (document.visibilityState === 'hidden') {
      this._capture();
    }
  };
}
