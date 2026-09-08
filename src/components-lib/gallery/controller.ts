import type { LitElement, ReactiveController } from 'lit';

import type { ViewManagerEpoch } from '../../card-controller/view/types';
import type { AdvancedCameraCardView } from '../../config/schema/common/const';
import {
  THUMBNAIL_SIZE_DEFAULT,
  type ThumbnailsControlBaseConfig,
} from '../../config/schema/common/controls/thumbnails';
import { errorToConsole } from '../../utils/basic';
import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { QueryResults } from '../../view/query-results';
import type { UnifiedQuery } from '../../view/unified-query';
import type { UnifiedQueryRunner } from '../../view/unified-query-runner';
import type { View } from '../../view/view';
import {
  resolveThumbnailDetailsStyle,
  type ResolvedThumbnailDetailsStyle,
} from '../thumbnail/resolve-details-style';
import type { GalleryColumnCountRoundMethod } from './gallery-core-controller';

interface GalleryViewContext {
  // The gallery view type the user navigated from (when in viewer). Used to
  // determine if query/results should be preserved when returning.
  originView?: AdvancedCameraCardView;
}

declare module 'view' {
  interface ViewContext {
    gallery?: GalleryViewContext;
  }
}

const MEDIA_DETAILS_PANEL_WIDTH = 200;

// The narrowest a media column may be, regardless of the thumbnail size.
const MEDIA_DETAILS_PANEL_COLUMN_WIDTH_MIN = 300;

// A folder details panel shows only a name, a count and a date range so needs
// less space.
const FOLDER_DETAILS_PANEL_WIDTH = 170;

export class GalleryController implements ReactiveController {
  private _host: LitElement;
  private _items: ViewItem[] | null = null;
  private _foldersOnly = false;
  private _width: number | null = null;

  private _thumbnailConfig: ThumbnailsControlBaseConfig | null = null;
  private _resolvedDetailsStyle: ResolvedThumbnailDetailsStyle | null = null;

  private _resizeObserver: ResizeObserver;

  public constructor(host: LitElement) {
    this._host = host;
    this._host.addController(this);

    this._resizeObserver = new ResizeObserver(() => this._setWidth());
  }

  public hostConnected(): void {
    this._resizeObserver.observe(this._host);
  }

  public hostDisconnected(): void {
    this._resizeObserver.disconnect();
    this._width = null;
    this._setResolvedDetailsStyle();
  }

  public getItems(): ViewItem[] | null {
    return this._items;
  }

  private _setWidth(): void {
    const width = this._host.clientWidth;
    if (width === this._width) {
      return;
    }
    this._width = width;

    if (this._setResolvedDetailsStyle()) {
      this._host.requestUpdate();
    }
  }

  private _setResolvedDetailsStyle(): boolean {
    const previous = this._resolvedDetailsStyle;
    this._resolvedDetailsStyle = this._thumbnailConfig
      ? resolveThumbnailDetailsStyle(this._thumbnailConfig, {
          placement: 'grid',
          availableWidth: this._width ?? undefined,
        })
      : null;
    return this._resolvedDetailsStyle !== previous;
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

  public setThumbnailConfig(thumbnailConfig?: ThumbnailsControlBaseConfig): void {
    this._thumbnailConfig = thumbnailConfig ?? null;
    this._setResolvedDetailsStyle();

    this._host.style.setProperty(
      '--advanced-camera-card-thumbnail-size',
      `${thumbnailConfig?.size ?? THUMBNAIL_SIZE_DEFAULT}px`,
    );
  }

  public getResolvedThumbnailDetailsStyle(): ResolvedThumbnailDetailsStyle | null {
    return this._resolvedDetailsStyle;
  }

  public getColumnWidth(): number {
    const size = this._thumbnailConfig?.size ?? THUMBNAIL_SIZE_DEFAULT;
    if (this._resolvedDetailsStyle !== 'panel') {
      return size;
    }

    return this._foldersOnly
      ? size + FOLDER_DETAILS_PANEL_WIDTH
      : Math.max(MEDIA_DETAILS_PANEL_COLUMN_WIDTH_MIN, size + MEDIA_DETAILS_PANEL_WIDTH);
  }

  public getColumnCountRoundMethod(): GalleryColumnCountRoundMethod {
    return this._resolvedDetailsStyle === 'panel' ? 'floor' : 'ceil';
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
      errorToConsole(e);
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
