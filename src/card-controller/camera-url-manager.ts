import { ViewItemClassifier } from '../view/item-classifier';
import { CardCameraURLAPI } from './types';

export class CameraURLManager {
  protected _api: CardCameraURLAPI;

  constructor(api: CardCameraURLAPI) {
    this._api = api;
  }

  public openURL(): void {
    const url = this.getCameraURL();
    if (url) {
      window.open(url);
    }
  }

  public hasCameraURL(): boolean {
    return !!this.getCameraURL();
  }

  public getCameraURL(): string | null {
    const view = this._api.getViewManager().getView();
    const item = view?.queryResults?.getSelectedResult() ?? null;
    const endpoints = view?.camera
      ? this._api.getCameraManager().getCameraEndpoints(view.camera, {
          view: view.view,
          ...(item && ViewItemClassifier.isMedia(item) && { media: item }),
        }) ?? null
      : null;
    return endpoints?.ui?.endpoint ?? null;
  }
}
