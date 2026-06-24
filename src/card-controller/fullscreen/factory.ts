import screenfull from 'screenfull';

import type { WebkitHTMLVideoElement } from '../../types';
import type { CardFullscreenAPI } from '../types';
import { ScreenfullFullScreenProvider } from './screenfull';
import type { FullscreenHandler, FullscreenProvider } from './types';
import { WebkitFullScreenProvider } from './webkit';

export class FullscreenProviderFactory {
  public static create(
    api: CardFullscreenAPI,
    handler: FullscreenHandler,
  ): FullscreenProvider | null {
    if (screenfull.isEnabled) {
      return new ScreenfullFullScreenProvider(api, handler);
    }

    const video = document.createElement('video') as Partial<WebkitHTMLVideoElement>;
    if (!!video.webkitEnterFullscreen) {
      return new WebkitFullScreenProvider(api, handler);
    }

    return null;
  }
}
