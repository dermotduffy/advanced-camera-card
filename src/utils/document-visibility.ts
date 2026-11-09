import type { UnsubscribeCallback } from '../types';
import { InFlightTracker } from './concurrency/in-flight-tracker';

type DocumentVisibilityCallback = (visible: boolean) => void;

/**
 * The document's visibility.
 *
 * Android WebView reports the page as hidden while it moves the page into a
 * fullscreen view. This class counts the document as visible when it is visible
 * OR while a fullscreen request is pending: a fullscreen request needs a user
 * gesture, so the page was visible when the request started.
 */
export class DocumentVisibility {
  private _fullscreenRequests = new InFlightTracker();

  public isVisible(): boolean {
    return (
      document.visibilityState === 'visible' || this._fullscreenRequests.isInFlight()
    );
  }

  /**
   * Track a fullscreen request until its promise settles: it resolves once the
   * browser has entered fullscreen, or rejects if the browser refuses.
   */
  public trackFullscreenRequest(request: Promise<unknown>): void {
    this._fullscreenRequests.track(request);
  }

  /**
   * Subscribe to changes in visibility. The callback is not called with the
   * current value.
   */
  public subscribe(callback: DocumentVisibilityCallback): UnsubscribeCallback {
    let visible = this.isVisible();
    const evaluate = (): void => {
      const current = this.isVisible();
      if (current !== visible) {
        visible = current;
        callback(current);
      }
    };

    document.addEventListener('visibilitychange', evaluate);
    const unsubscribeFullscreenRequests = this._fullscreenRequests.subscribe(evaluate);

    return () => {
      document.removeEventListener('visibilitychange', evaluate);
      unsubscribeFullscreenRequests();
    };
  }
}

export const sharedDocumentVisibility = new DocumentVisibility();
