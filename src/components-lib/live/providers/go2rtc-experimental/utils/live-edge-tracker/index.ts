// Keeps MSE playback near the live edge. The strategy is browser-specific: see
// ./webkit.ts (seek-based, because WebKit stutters on playbackRate changes) and
// ./non-webkit.ts (playback-rate-based).

import { NonWebKitLiveEdgeStrategy } from './non-webkit';
import type { LiveEdgeAction, LiveEdgeStatus, LiveEdgeStrategy } from './types';
import { WebKitLiveEdgeStrategy } from './webkit';

// Picks the browser-appropriate live-edge strategy and delegates to it.
export class LiveEdgeTracker {
  private _strategy: LiveEdgeStrategy;

  constructor(options: { webkit: boolean }) {
    this._strategy = options.webkit
      ? new WebKitLiveEdgeStrategy()
      : new NonWebKitLiveEdgeStrategy();
  }

  public next(status: LiveEdgeStatus): LiveEdgeAction {
    return this._strategy.next(status);
  }
}
