import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { PreservedFrameManager } from '../card-controller/preserved-frame-manager';
import { onAbort } from '../utils/abort-signal';
import type { PreservedFrame } from '../utils/preserved-frame-store';
import { Timer } from '../utils/timer';

interface PreservedFrameDisplayControllerOptions {
  getCameraID: () => string | null;
  getManager: () => PreservedFrameManager | null;

  // Returns the URL the host displays. The controller tells the manager that
  // the host shows the preserved frame while this matches the frame's URL.
  getShownURL: () => string | null;

  // Called when the preserved frame the host displays becomes too old, or a
  // newer frame is preserved for the camera (e.g. one whose encoding finished
  // after the host was created).
  onShownFrameOutdated: () => void;
}

/**
 * Gives its host a camera's preserved frame, and tells the card's
 * `PreservedFrameManager` while the host displays that frame.
 */
export class PreservedFrameDisplayController implements ReactiveController {
  private _options: PreservedFrameDisplayControllerOptions;

  // The preserved frame the host shows, or null for none.
  private _showingFrame: PreservedFrame | null = null;

  // Aborts the signal last given to the manager when the host stops displaying
  // `_showingFrame`.
  private _showingAbort: AbortController | null = null;

  // Runs until the preserved frame the host displays becomes too old.
  private _expiryTimer = new Timer();

  // Frames captured before this date are not given to the host.
  private _dismissedDate: Date | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: PreservedFrameDisplayControllerOptions,
  ) {
    this._options = options;

    host.addController(this);
  }

  public hostUpdated(): void {
    const frame = this.getPreservedFrame();
    const showingFrame =
      frame && frame.url === this._options.getShownURL() ? frame : null;

    this._setShowingFrame(showingFrame);
    this._setExpiryTimer(showingFrame);
  }

  public hostDisconnected(): void {
    this._setShowingFrame(null);
    this._setExpiryTimer(null);
  }

  /** Whether the host shows the camera's preserved frame. */
  public isShowingPreservedFrame(): boolean {
    return !!this._showingFrame;
  }

  /** Stop giving the host frames captured before now. */
  public dismiss(): void {
    this._dismissedDate = new Date();
  }

  /**
   * The camera's preserved frame, or null if there is none, it's too old or the
   * host dismissed it.
   */
  public getPreservedFrame(): PreservedFrame | null {
    const cameraID = this._options.getCameraID();
    const frame = cameraID ? this._options.getManager()?.get(cameraID) ?? null : null;
    return frame && (!this._dismissedDate || frame.date > this._dismissedDate)
      ? frame
      : null;
  }

  private _setShowingFrame(frame: PreservedFrame | null): void {
    if (frame === this._showingFrame) {
      return;
    }

    this._showingAbort?.abort();
    this._showingAbort = null;
    this._showingFrame = null;

    const cameraID = this._options.getCameraID();
    const manager = this._options.getManager();
    if (!frame || !cameraID || !manager) {
      return;
    }

    this._showingFrame = frame;
    this._showingAbort = new AbortController();
    manager.setShowing(cameraID, frame, this._showingAbort.signal);
    onAbort(
      this._showingAbort.signal,
      manager.subscribe(cameraID, () => this._options.onShownFrameOutdated()),
    );
  }

  // The timer restarts on every call, as the maximum age may have changed.
  private _setExpiryTimer(frame: PreservedFrame | null): void {
    const cameraID = this._options.getCameraID();
    const manager = this._options.getManager();
    if (!frame || !cameraID || !manager) {
      this._expiryTimer.stop();
      return;
    }

    this._expiryTimer.start(manager.getSecondsUntilExpired(cameraID, frame), () =>
      this._options.onShownFrameOutdated(),
    );
  }
}
