import { ViewManagerEpoch } from '../../card-controller/view/types';
import { AdvancedCameraCardView } from '../../config/schema/common/const';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../config/schema/common/controls/thumbnails';
import { MediaGalleryThumbnailsConfig } from '../../config/schema/media-gallery';
import { errorToConsole } from '../../utils/basic';
import { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { QueryResults } from '../../view/query-results';
import { UnifiedQuery } from '../../view/unified-query';
import { UnifiedQueryRunner } from '../../view/unified-query-runner';
import { View } from '../../view/view';
import { GalleryColumnCountRoundMethod } from './gallery-core-controller';

export interface GalleryViewContext {
  // The gallery view type the user navigated from (when in viewer). Used to
  // determine if query/results should be preserved when returning.
  originView?: AdvancedCameraCardView;
}

declare module 'view' {
  interface ViewContext {
    gallery?: GalleryViewContext;
  }
}

// The minimum width of a thumbnail with details enabled.
export const GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN = 300;

// The minimum width of a folder thumbnail with details enabled.
export const FOLDER_THUMBNAIL_DETAILS_WIDTH_MIN = 200;

export class GalleryController {
  private _host: HTMLElement;
  private _items: ViewItem[] | null = null;
  private _foldersOnly = false;

  public constructor(host: HTMLElement) {
    this._host = host;
  }

  public getItems(): ViewItem[] | null {
    return this._items;
  }

  /**
   * Set items from view query results.
   * Media is reversed so newest appears first in the gallery.
   */
  public setItemsFromView(newView?: View | null, oldView?: View | null): void {
    const newResults = newView?.queryResults?.getResults() ?? null;
    if (newResults === null) {
      this._items = null;
      return;
    }

    if (!this._items || oldView?.queryResults?.getResults() !== newResults) {
      // Gallery places the most recent media at the top (the query results
      // place the most recent media at the end for use in the viewer).
      this._items = [...newResults].reverse();
    }

    this._foldersOnly = this._items?.every((item) => ViewItemClassifier.isFolder(item));
  }

  public setThumbnailSize(size?: number): void {
    this._host.style.setProperty(
      '--advanced-camera-card-thumbnail-size',
      `${size ?? THUMBNAIL_WIDTH_DEFAULT}px`,
    );
  }

  public getColumnWidth(thumbnailConfig?: MediaGalleryThumbnailsConfig): number {
    if (!thumbnailConfig) {
      return THUMBNAIL_WIDTH_DEFAULT;
    }
    if (!thumbnailConfig.show_details) {
      return thumbnailConfig.size;
    }

    // Use smaller width when all items are folders
    return this._foldersOnly
      ? FOLDER_THUMBNAIL_DETAILS_WIDTH_MIN
      : GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN;
  }

  public getColumnCountRoundMethod(
    thumbnailConfig?: MediaGalleryThumbnailsConfig,
  ): GalleryColumnCountRoundMethod {
    return thumbnailConfig?.show_details ? 'floor' : 'ceil';
  }

  public async extend(
    runner: UnifiedQueryRunner,
    viewManagerEpoch: ViewManagerEpoch,
    direction: 'earlier' | 'later',
    useCache = true,
  ): Promise<void> {
    const view = viewManagerEpoch.manager.getView();
    if (!view?.query || !view?.queryResults) {
      return;
    }

    const existingResults = view.queryResults.getResults();
    if (!existingResults) {
      return;
    }

    let extended: { query: UnifiedQuery; results: ViewItem[] } | null;
    try {
      extended = await runner.extend(view.query, existingResults, direction, {
        useCache,
      });
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }

    if (extended) {
      viewManagerEpoch.manager.setViewByParameters({
        baseView: view,
        params: {
          query: extended.query,
          queryResults: new QueryResults({
            results: extended.results,
          }).selectResultIfFound(
            (item) => item === view.queryResults?.getSelectedResult(),
          ),
        },
      });
    }
  }
}
