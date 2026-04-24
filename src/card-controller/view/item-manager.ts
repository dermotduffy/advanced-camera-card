import { format } from 'date-fns';
import { createNotificationFromError } from '../../components-lib/notification/factory';
import { homeAssistantGetSignedURLIfNecessary } from '../../ha/sign-path';
import { localize } from '../../localize/localize';
import { AdvancedCameraCardError } from '../../types';
import { errorToConsole } from '../../utils/basic';
import { downloadURL } from '../../utils/download';
import { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { ViewItemCapabilities } from '../../view/types';
import { CardViewAPI } from '../types';

enum ViewMediaSource {
  Camera = 'camera',
  Folder = 'folder',
}

export class ViewItemManager {
  private _api: CardViewAPI;

  constructor(api: CardViewAPI) {
    this._api = api;
  }

  public getCapabilities(item: ViewItem): ViewItemCapabilities | null {
    const source = this._getMediaSource(item);
    if (source === ViewMediaSource.Camera && ViewItemClassifier.isMedia(item)) {
      return this._api.getCameraManager().getMediaCapabilities(item);
    }
    if (source === ViewMediaSource.Folder) {
      return this._api.getFoldersManager().getItemCapabilities(item);
    }

    return null;
  }

  public async download(item: ViewItem): Promise<boolean> {
    try {
      await this._download(item);
    } catch (error: unknown) {
      /* istanbul ignore if: catch always provides a non-null error -- @preserve */
      if (error == null) {
        return false;
      }
      this._api.getNotificationManager().setNotification(
        createNotificationFromError(error, {
          heading: { text: localize('error.download_failed'), icon: 'mdi:download-off' },
        }),
      );
      return false;
    }
    return true;
  }

  public async favorite(item: ViewItem, favorite: boolean): Promise<void> {
    const source = this._getMediaSource(item);
    if (source === ViewMediaSource.Camera && ViewItemClassifier.isMedia(item)) {
      return await this._api.getCameraManager().favoriteMedia(item, favorite);
    }
    /* istanbul ignore else: this path cannot be reached -- @preserve */
    if (source === ViewMediaSource.Folder) {
      return this._api.getFoldersManager().favorite(item, favorite);
    }
  }

  public async reviewMedia(item: ViewItem, reviewed: boolean): Promise<void> {
    if (ViewItemClassifier.isReview(item)) {
      return await this._api.getCameraManager().reviewMedia(item, reviewed);
    }
  }

  private _getMediaSource(item: ViewItem): ViewMediaSource | null {
    if (ViewItemClassifier.isMedia(item) && item.getCameraID()) {
      return ViewMediaSource.Camera;
    }
    if (ViewItemClassifier.isFolder(item) || item.getFolder()) {
      return ViewMediaSource.Folder;
    }

    /* istanbul ignore next: this path cannot be reached -- @preserve */
    return null;
  }

  private async _download(item: ViewItem): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass) {
      return;
    }

    const source = this._getMediaSource(item);
    const endpoint =
      source === ViewMediaSource.Camera && ViewItemClassifier.isMedia(item)
        ? await this._api.getCameraManager().getMediaDownloadPath(item)
        : source === ViewMediaSource.Folder
          ? await this._api.getFoldersManager().getDownloadPath(item)
          : null;

    if (!endpoint) {
      throw new AdvancedCameraCardError(localize('error.download_no_media'));
    }

    let url: string | null;
    try {
      url = await homeAssistantGetSignedURLIfNecessary(hass, endpoint);
    } catch (e) {
      errorToConsole(e as Error);
      url = null;
    }

    if (!url) {
      throw new AdvancedCameraCardError(localize('error.download_sign_failed'));
    }

    downloadURL(url, this._generateDownloadFilename(item));
  }

  private _generateDownloadFilename(item: ViewItem): string {
    const toFilename = (input: string): string => {
      return input.toLowerCase().replaceAll(/[^a-z0-9]/gi, '-');
    };

    if (ViewItemClassifier.isMedia(item)) {
      const cameraID = item.getCameraID();
      const id = item.getID();
      const startTime = item.getStartTime();

      return (
        (cameraID ? toFilename(cameraID) : 'media') +
        (id ? `_${toFilename(id)}` : '') +
        (startTime ? `_${format(startTime, `yyyy-MM-dd-HH-mm-ss`)}` : '') +
        ('.' + (item.getMediaType() === 'clip' ? 'mp4' : 'jpg'))
      );
    }

    /* istanbul ignore else: this path cannot be reached -- @preserve */
    if (ViewItemClassifier.isFolder(item)) {
      return toFilename(item.getTitle() ?? 'media');
    }

    /* istanbul ignore next: this path cannot be reached -- @preserve */
    return 'download';
  }
}
