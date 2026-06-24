import screenfull from 'screenfull';

import { FullscreenProviderBase } from '../provider';
import type { FullscreenProvider } from '../types';

export class ScreenfullFullScreenProvider
  extends FullscreenProviderBase
  implements FullscreenProvider
{
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

    if (fullscreen) {
      // A denied request (or an exit when not in fullscreen) leaves the UI
      // consistent: the 'change' handler only fires on a real transition.
      // Nothing to act on.
      screenfull.request(this._api.getCardElementManager().getElement()).catch(() => {});
    } else {
      screenfull.exit().catch(() => {});
    }
  }
}
