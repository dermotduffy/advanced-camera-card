import { OverlayMessage } from '../types';
import { CardOverlayMessageAPI } from './types';

export class OverlayMessageManager {
  protected _message: OverlayMessage | null = null;
  protected _api: CardOverlayMessageAPI;

  constructor(api: CardOverlayMessageAPI) {
    this._api = api;
  }

  public getMessage(): OverlayMessage | null {
    return this._message;
  }

  public hasMessage(): boolean {
    return this._message !== null;
  }

  public setMessage(message: OverlayMessage): void {
    this._message = message;
    this._api.getCardElementManager().update();
  }

  public reset(): void {
    if (this._message) {
      this._message = null;
      this._api.getCardElementManager().update();
    }
  }
}
