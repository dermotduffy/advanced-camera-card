import { isBeingCasted } from '../../utils/casting';
import { CardFullscreenAPI } from '../types';
import { FullscreenProviderFactory } from './factory';
import { FullscreenProvider } from './types';

export class FullscreenManager {
  private _api: CardFullscreenAPI;
  private _provider: FullscreenProvider | null;

  constructor(api: CardFullscreenAPI, provider?: FullscreenProvider) {
    this._api = api;
    this._provider =
      provider ?? FullscreenProviderFactory.create(api, this._fullscreenHandler);
  }

  public connect(): void {
    this._provider?.connect();
  }

  public disconnect(): void {
    this._provider?.disconnect();
  }

  public setFullscreen(fullscreen: boolean): void {
    this._provider?.setFullscreen(fullscreen);
  }

  public isInFullscreen(): boolean {
    return this._provider?.isInFullscreen() ?? false;
  }

  public isSupported(): boolean {
    if (isBeingCasted()) {
      return false;
    }
    return this._provider?.isSupported() ?? false;
  }

  public initialize(): void {
    this._setConditionState();
  }

  public toggleFullscreen(): void {
    if (this._provider?.isInFullscreen()) {
      this._provider.setFullscreen(false);
    } else {
      this._provider?.setFullscreen(true);
    }
  }

  private _fullscreenHandler = (): void => {
    this._api.getExpandManager().setExpanded(false);

    this._setConditionState();

    // Re-render after a change to fullscreen mode to take advantage of
    // the expanded screen real-estate (vs staying in aspect-ratio locked
    // modes).
    this._api.getCardElementManager().update();
  };

  private _setConditionState(): void {
    this._api.getConditionStateManager()?.setState({
      fullscreen: this.isInFullscreen(),
    });
  }
}
