import { ViewManagerInterface } from '../../card-controller/view/types';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../config/schema/common/controls/thumbnails';
import { MediaGalleryThumbnailsConfig } from '../../config/schema/media-gallery';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { QueryClassifier } from '../../view/query-classifier';
import { GalleryColumnCountRoundMethod } from './gallery-core-controller';

// The minimum width of a (folder) thumbnail with details enabled. This is
// shorter than for regular camera media as this will consist of just a name.
export const FOLDER_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN = 200;

export class FolderGalleryController {
  private _host: HTMLElement;

  public constructor(host: HTMLElement) {
    this._host = host;
  }

  public setThumbnailSize(size?: number): void {
    this._host.style.setProperty(
      '--advanced-camera-card-thumbnail-size',
      `${size ?? THUMBNAIL_WIDTH_DEFAULT}px`,
    );
  }

  public getColumnWidth(thumbnailConfig?: MediaGalleryThumbnailsConfig): number {
    return !thumbnailConfig
      ? THUMBNAIL_WIDTH_DEFAULT
      : thumbnailConfig.show_details
        ? FOLDER_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN
        : thumbnailConfig.size;
  }

  public getColumnCountRoundMethod(
    thumbnailConfig?: MediaGalleryThumbnailsConfig,
  ): GalleryColumnCountRoundMethod {
    return thumbnailConfig?.show_details ? 'floor' : 'ceil';
  }

  public itemClickHandler(
    viewManager: ViewManagerInterface,
    item: ViewItem,
    ev: Event,
  ): void {
    stopEventFromActivatingCardWideActions(ev);

    const view = viewManager.getView();
    if (!view) {
      return;
    }
    if (ViewItemClassifier.isMedia(item)) {
      viewManager.setViewByParameters({
        params: {
          view: 'media',
          queryResults: view.queryResults
            ?.clone()
            .selectResultIfFound((result) => result === item),
        },
      });
    } else if (
      ViewItemClassifier.isFolder(item) &&
      QueryClassifier.isFolderQuery(view.query)
    ) {
      const rawQuery = view.query.getQuery();
      const id = item.getID();
      if (!rawQuery || !id) {
        return;
      }
      viewManager.setViewByParametersWithExistingQuery({
        params: {
          query: view.query.clone().setQuery({
            folder: rawQuery.folder,
            path: [...rawQuery.path, { id }],
          }),
        },
      });
    }
  }
}
