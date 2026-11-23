import screenfull from 'screenfull';

import {
  sharedDocumentVisibility,
  type DocumentVisibility,
} from '../../../utils/document-visibility';
import { Timer } from '../../../utils/timer';
import type { CardFullscreenAPI } from '../../types';
import { FullscreenProviderBase } from '../provider';
import type { FullscreenHandler, FullscreenProvider } from '../types';

// Android WebView fires the fullscreen change event only once the page is
// shown again. Should a user lock an Android phone just after requesting
// fullscreen, the request would stay pending, and the page count as still
// visible, until the user returns. This may have knock on effects, e.g.
// microphone staying unmuted. This time limit ends the request instead, after
// which the page's real visibility applies. This timeout is far longer than a
// browser takes to enter fullscreen.
const FULLSCREEN_REQUEST_LIMIT_SECONDS = 5;

export class ScreenfullFullScreenProvider
  extends FullscreenProviderBase
  implements FullscreenProvider
{
  private _documentVisibility: DocumentVisibility;

  constructor(
    api: CardFullscreenAPI,
    handler: FullscreenHandler,
    documentVisibility?: DocumentVisibility,
  ) {
    super(api, handler);
    this._documentVisibility = documentVisibility ?? sharedDocumentVisibility;
  }

  public connect(): void {
    if (screenfull.isEnabled) {
      screenfull.on('change', this._handler);
    }
  }

  public disconnect(): void {
    if (screenfull.isEnabled) {
      screenfull.off('change', this._handler);
    }
  }

  public isInFullscreen(): boolean {
    return screenfull.isEnabled && screenfull.isFullscreen;
  }

  public isSupported(): boolean {
    return screenfull.isEnabled;
  }

  public setFullscreen(fullscreen: boolean): void {
    if (!this.isSupported()) {
      return;
    }

    // A denied request (or an exit when not in fullscreen) leaves the UI
    // consistent: the 'change' handler only fires on a real transition.
    // Nothing to act on.
    if (!fullscreen) {
      screenfull.exit().catch(() => {});
      return;
    }

    const element = this._api.getCardElementManager().getElement();

    // A request made while already in fullscreen does not move the page into a
    // fullscreen view, and may complete without a change event.
    if (screenfull.isFullscreen) {
      screenfull.request(element).catch(() => {});
    } else {
      this._documentVisibility.trackFullscreenRequest(this._requestFullscreen(element));
    }
  }

  /**
   * Request fullscreen. The returned promise resolves once the request has
   * completed or failed, or after `FULLSCREEN_REQUEST_LIMIT_SECONDS`, and never
   * rejects.
   */
  private _requestFullscreen(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const timer = new Timer();
      const settle = (): void => {
        timer.stop();
        screenfull.off('change', settle);
        screenfull.off('error', settle);
        resolve();
      };

      // Android WebView resolves the request while the page is still hidden,
      // and fires the change event only once the page is shown again, so the
      // change event marks completion rather than the request resolving.
      screenfull.on('change', settle);

      // Prefixed WebKit reports a failed request only through the error event,
      // which leaves the promise from `screenfull.request()` pending forever.
      screenfull.on('error', settle);

      timer.start(FULLSCREEN_REQUEST_LIMIT_SECONDS, settle);

      screenfull.request(element).catch(settle);
    });
  }
}
