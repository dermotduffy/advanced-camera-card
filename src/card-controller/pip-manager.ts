import { ConditionStateChange } from '../conditions/types';
import { PIPElement } from '../types';
import { CardPIPAPI } from './types';

export class PIPManager {
  private _api: CardPIPAPI;
  private _videoElement: PIPElement | null = null;
  private _disconnect: (() => void) | null = null;

  constructor(api: CardPIPAPI) {
    this._api = api;
  }

  public static isSupported(): boolean {
    return !!document.pictureInPictureEnabled;
  }

  public initialize(): void {
    this._api.getConditionStateManager().addListener(this._stateChangeHandler);
  }

  public uninitialize(): void {
    this._trackElement(null);
    this._api.getConditionStateManager().removeListener(this._stateChangeHandler);
  }

  public isInPIP(): boolean {
    return !!document.pictureInPictureElement;
  }

  public isAvailable(): boolean {
    return PIPManager.isSupported() && !!this._videoElement;
  }

  public async togglePIP(): Promise<void> {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (this._videoElement && PIPManager.isSupported()) {
      await this._videoElement.requestPictureInPicture();
    }
  }

  private _stateChangeHandler = (change: ConditionStateChange): void => {
    const oldElement =
      change.old.mediaLoadedInfo?.mediaPlayerController?.getPIPElement() ?? null;
    const newElement =
      change.new.mediaLoadedInfo?.mediaPlayerController?.getPIPElement() ?? null;

    if (oldElement !== newElement) {
      // Exit PIP when the video element is destroyed (e.g. view change) to
      // avoid a black/empty PIP window.
      if (!newElement && this.isInPIP()) {
        // Ignore errors in existing PIP.
        document.exitPictureInPicture().catch(() => {});
      }
      this._trackElement(newElement);
      this._api.getCardElementManager().update();
    }
  };

  private _trackElement(element: PIPElement | null): void {
    this._disconnect?.();
    this._disconnect = null;
    this._videoElement = element;

    if (element) {
      const handler = (): void => this._api.getCardElementManager().update();
      element.addEventListener('enterpictureinpicture', handler);
      element.addEventListener('leavepictureinpicture', handler);
      this._disconnect = () => {
        element.removeEventListener('enterpictureinpicture', handler);
        element.removeEventListener('leavepictureinpicture', handler);
      };
    }
  }
}
