import { downloadMedia, downloadURL } from '../utils/download';
import { generateScreenshotFilename } from '../utils/screenshot';
import { CardDownloadAPI } from './types';

export class DownloadManager {
  protected _api: CardDownloadAPI;

  constructor(api: CardDownloadAPI) {
    this._api = api;
  }

  public async downloadViewerMedia(): Promise<boolean> {
    const media = this._api
      .getViewManager()
      .getView()
      ?.queryResults?.getSelectedResult();
    const hass = this._api.getHASSManager().getHASS();

    if (!media || !hass) {
      return false;
    }

    try {
      await downloadMedia(hass, this._api.getCameraManager(), media);
    } catch (error: unknown) {
      this._api.getMessageManager().setErrorIfHigherPriority(error);
      return false;
    }
    return true;
  }

  public async downloadScreenshot(): Promise<void> {
    const url = await this._api
      .getMediaLoadedInfoManager()
      .get()
      ?.mediaPlayerController?.getScreenshotURL();
    if (url) {
      downloadURL(url, generateScreenshotFilename(this._api.getViewManager().getView()));
    }
  }
}
