import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { CameraConfig } from '../config/schema/cameras';
import type { ImageBaseConfig } from '../config/schema/common/image';
import {
  getLastFrameKey,
  lastFrameStore,
  type LastFrame,
  type LastFrameStore,
} from '../utils/last-frame-store';

interface LastFrameImageControllerOptions {
  getCameraID: () => string | null;
  // The camera's configuration: with the ID, the key its frame is kept under.
  getCameraConfig: () => CameraConfig | null;
  // The image configuration while its mode is `last_frame`, otherwise null.
  getImageConfig: () => ImageBaseConfig | null;
  // A new frame arrived for the camera.
  onChange: () => void;
}

/**
 * The frame an image in mode `last_frame` shows: the camera's last captured
 * frame (live/last-frame-controller.ts).
 */
export class LastFrameImageController implements ReactiveController {
  private _options: LastFrameImageControllerOptions;
  private _store: LastFrameStore;
  private _unsubscribe: (() => void) | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: LastFrameImageControllerOptions,
    store: LastFrameStore = lastFrameStore,
  ) {
    this._options = options;
    this._store = store;
    host.addController(this);
  }

  public hostConnected(): void {
    this._unsubscribe = this._store.subscribe((key) => {
      if (key === this._getKey() && this._options.getImageConfig()) {
        this._options.onChange();
      }
    });
  }

  public hostDisconnected(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  public getLastFrame(): LastFrame | null {
    const key = this._getKey();
    return key && this._options.getImageConfig() ? this._store.get(key) : null;
  }

  private _getKey(): string | null {
    const cameraID = this._options.getCameraID();
    return cameraID ? getLastFrameKey(cameraID, this._options.getCameraConfig()) : null;
  }
}
