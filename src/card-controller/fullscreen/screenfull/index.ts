import screenfull from 'screenfull';
import { FullscreenProviderBase } from '../provider';
import { FullscreenProvider } from '../types';

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
      void screenfull.request(this._api.getCardElementManager().getElement());
    } else {
      void screenfull.exit();
    }
  }
}
