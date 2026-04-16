import { MediaLoadedInfo } from '../types';
import { log } from '../utils/debug';
import { isValidMediaLoadedInfo } from '../utils/media-info';
import { CardMediaLoadedAPI } from './types';

export class MediaLoadedInfoManager {
  protected _api: CardMediaLoadedAPI;
  protected _current: MediaLoadedInfo | null = null;
  protected _lastKnown: MediaLoadedInfo | null = null;
  protected _currentByCamera = new Map<string, MediaLoadedInfo>();
  protected _lastKnownByCamera = new Map<string, MediaLoadedInfo>();

  constructor(api: CardMediaLoadedAPI) {
    this._api = api;
  }

  public initialize(): void {
    this.clear({ all: true });
  }

  public set(
    mediaLoadedInfo: MediaLoadedInfo,
    options?: {
      cameraID?: string | null;
      selectCurrent?: boolean;
    },
  ): void {
    if (!isValidMediaLoadedInfo(mediaLoadedInfo)) {
      return;
    }

    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Advanced Camera Card media load: `,
      mediaLoadedInfo,
    );

    const cameraID = options?.cameraID ?? undefined;
    if (cameraID) {
      this._currentByCamera.set(cameraID, mediaLoadedInfo);
      this._lastKnownByCamera.set(cameraID, mediaLoadedInfo);
    }

    if (options?.selectCurrent ?? true) {
      this._current = mediaLoadedInfo;
      this._lastKnown = mediaLoadedInfo;

      this._api.getConditionStateManager().setState({
        mediaLoadedInfo: mediaLoadedInfo,
      });

      // Fresh media information may change how the card is rendered.
      this._api.getStyleManager().setExpandedMode();
    }

    this._api.getCardElementManager().update();
  }

  public get(cameraID?: string | null): MediaLoadedInfo | null {
    if (cameraID) {
      return this._currentByCamera.get(cameraID) ?? null;
    }
    return this._current;
  }

  public getLastKnown(cameraID?: string | null): MediaLoadedInfo | null {
    if (cameraID) {
      return this._lastKnownByCamera.get(cameraID) ?? null;
    }
    return this._lastKnown;
  }

  public clear(options?: { cameraID?: string | null; all?: boolean }): void {
    if (options?.all) {
      this._current = null;
      this._currentByCamera.clear();
      this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
      return;
    }

    const cameraID = options?.cameraID ?? undefined;
    if (cameraID) {
      const current = this._currentByCamera.get(cameraID) ?? null;
      this._currentByCamera.delete(cameraID);

      if (current && this._current === current) {
        this._current = null;
        this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
      }
      return;
    }

    this._current = null;
    this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
  }

  public has(cameraID?: string | null): boolean {
    return !!this.get(cameraID);
  }
}
