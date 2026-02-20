import { MediaLoadedInfo } from '../types';
import { log } from '../utils/debug';
import { isValidMediaLoadedInfo } from '../utils/media-info';
import { CardMediaLoadedAPI } from './types';

export class MediaLoadedInfoManager {
  private _api: CardMediaLoadedAPI;
  private _current: MediaLoadedInfo | null = null;
  private _lastKnown: MediaLoadedInfo | null = null;

  constructor(api: CardMediaLoadedAPI) {
    this._api = api;
  }

  public initialize(): void {
    this.clear();
  }

  public set(mediaLoadedInfo: MediaLoadedInfo): void {
    if (!isValidMediaLoadedInfo(mediaLoadedInfo)) {
      return;
    }

    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Advanced Camera Card media load: `,
      mediaLoadedInfo,
    );

    this._current = mediaLoadedInfo;
    this._lastKnown = mediaLoadedInfo;

    this._api.getConditionStateManager().setState({ mediaLoadedInfo: mediaLoadedInfo });

    // Fresh media information may change how the card is rendered.
    this._api.getStyleManager().setExpandedMode();
    this._api.getCardElementManager().update();
  }

  public get(): MediaLoadedInfo | null {
    return this._current;
  }

  public getLastKnown(): MediaLoadedInfo | null {
    return this._lastKnown;
  }

  public clear(): void {
    this._current = null;
    this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
  }

  public has(): boolean {
    return !!this._current;
  }
}
