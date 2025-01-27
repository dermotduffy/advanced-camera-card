import { CardFullscreenAPI } from '../types';
import { FullscreenHandler } from './types';

export class FullscreenProviderBase {
  protected _api: CardFullscreenAPI;
  protected _handler: FullscreenHandler;

  constructor(api: CardFullscreenAPI, handler: FullscreenHandler) {
    this._api = api;
    this._handler = handler;
  }
}
