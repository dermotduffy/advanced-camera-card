import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { MediaLoadedInfo } from '../types';
import { Timer } from '../utils/timer';
import { waitForPaint } from '../utils/wait-for-paint';

// The longest a preserved frame stays over loaded media that has not painted:
// arbitrary, a few times longer than a phone takes to paint a first frame.
export const PRESERVED_FRAME_HOLD_MAX_SECONDS = 2;

interface PreservedFrameHoldControllerOptions {
  // Whether the host's own loading image shows a preserved frame.
  isShowingPreservedFrame: () => boolean;
}

/**
 * Keeps a host's loading image over media that has loaded but not yet painted,
 * if that image shows a preserved frame.
 *
 * Loaded is not yet painted: media counts as loaded (e.g. at a video's
 * `loadeddata`) before the browser has drawn its first frame, so removing the
 * loading image in the same render shows a blank frame for a moment. The hold
 * ends once the media has painted, or after at most
 * PRESERVED_FRAME_HOLD_MAX_SECONDS so media that never paints is still shown.
 * An ordinary loading snapshot is not held.
 */
export class PreservedFrameHoldController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _options: PreservedFrameHoldControllerOptions;

  // Aborts when the current hold ends.
  private _hold: AbortController | null = null;
  private _timer = new Timer();

  constructor(
    host: ReactiveControllerHost,
    options: PreservedFrameHoldControllerOptions,
  ) {
    this._host = host;
    this._options = options;
    host.addController(this);
  }

  public hostDisconnected(): void {
    this._release();
  }

  /** Whether the host should keep its loading image over its media. */
  public isHolding(): boolean {
    return !!this._hold;
  }

  /**
   * Tell the controller about the host's active media (null when it has none).
   * Must be called before the host renders that media.
   */
  public setMedia(info: MediaLoadedInfo | null): void {
    this._release();

    if (info && this._options.isShowingPreservedFrame()) {
      void this._holdUntilPainted(info);
    }
  }

  private async _holdUntilPainted(info: MediaLoadedInfo): Promise<void> {
    const hold = new AbortController();
    this._hold = hold;
    this._timer.start(PRESERVED_FRAME_HOLD_MAX_SECONDS, () => this._release(hold));

    // The media can only paint once the host has rendered it visible. The
    // player's picture-in-picture element is its video, if it has one.
    await this._host.updateComplete;
    await waitForPaint(info.mediaPlayerController?.getPIPElement() ?? null, hold.signal);
    this._release(hold);
  }

  // Ends `hold` if given and still current, otherwise whichever hold there is.
  private _release(hold?: AbortController): void {
    if (!this._hold || (hold && hold !== this._hold)) {
      return;
    }
    this._hold.abort();
    this._hold = null;
    this._timer.stop();
    this._host.requestUpdate();
  }
}
