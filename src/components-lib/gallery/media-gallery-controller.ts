import { CameraManager, ExtendedMediaQueryResult } from '../../camera-manager/manager';
import { EventQuery, MediaQuery, RecordingQuery } from '../../camera-manager/types';
import {
  ViewManagerEpoch,
  ViewManagerInterface,
} from '../../card-controller/view/types';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../config/schema/common/controls/thumbnails';
import { MediaGalleryThumbnailsConfig } from '../../config/schema/media-gallery';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import { errorToConsole } from '../../utils/basic';
import { ViewItem } from '../../view/item';
import { EventMediaQuery, RecordingMediaQuery } from '../../view/query';
import { QueryClassifier } from '../../view/query-classifier';
import { QueryResults } from '../../view/query-results';
import { View } from '../../view/view';
import { GalleryColumnCountRoundMethod } from './gallery-core-controller';

// The minimum width of a thumbnail with details enabled.
export const MEDIA_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN = 300;

export class MediaGalleryController {
  private _host: HTMLElement;
  private _media: ViewItem[] | null = null;

  public constructor(host: HTMLElement) {
    this._host = host;
  }

  public getMedia(): ViewItem[] | null {
    return this._media;
  }

  public setMediaFromView(newView?: View | null, oldView?: View | null): void {
    const newResults = newView?.queryResults?.getResults() ?? null;
    if (newResults === null) {
      this._media = null;
      return;
    }

    if (!this._media || oldView?.queryResults?.getResults() !== newResults) {
      // Media gallery places the most recent media at the top (the query
      // results place the most recent media at the end for use in the viewer).
      // This is copied to a new array to avoid reversing the query results in
      // place.
      this._media = [...newResults].reverse();
    }
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
        ? MEDIA_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN
        : thumbnailConfig.size;
  }

  public getColumnCountRoundMethod(
    thumbnailConfig?: MediaGalleryThumbnailsConfig,
  ): GalleryColumnCountRoundMethod {
    return thumbnailConfig?.show_details ? 'floor' : 'ceil';
  }

  public async extendMediaGallery(
    cameraManager: CameraManager,
    viewManagerEpoch: ViewManagerEpoch,
    direction: 'earlier' | 'later',
    useCache = true,
  ): Promise<void> {
    const view = viewManagerEpoch.manager.getView();
    if (!view) {
      return;
    }

    const query = view.query;
    const existingMedia = view.queryResults?.getResults();
    if (!existingMedia || !query || !QueryClassifier.isMediaQuery(query)) {
      return;
    }

    const rawQueries = query.getQuery() ?? null;
    if (!rawQueries) {
      return;
    }

    let extension: ExtendedMediaQueryResult<MediaQuery> | null;
    try {
      extension = await cameraManager.extendMediaQueries<MediaQuery>(
        rawQueries,
        existingMedia,
        direction,
        {
          useCache: useCache,
        },
      );
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }

    if (extension) {
      const newMediaQueries = QueryClassifier.isEventQuery(query)
        ? new EventMediaQuery(extension.queries as EventQuery[])
        : QueryClassifier.isRecordingQuery(query)
          ? new RecordingMediaQuery(extension.queries as RecordingQuery[])
          : /* istanbul ignore next: this path cannot be reached -- @preserve */
            null;

      /* istanbul ignore else: this path cannot be reached, as we explicitly
         check for media queries above -- @preserve */
      if (newMediaQueries) {
        viewManagerEpoch.manager.setViewByParameters({
          baseView: view,
          params: {
            query: newMediaQueries,
            queryResults: new QueryResults({
              results: extension.results,
            }).selectResultIfFound(
              (media) => media === view.queryResults?.getSelectedResult(),
            ),
          },
        });
      }
    }
  }

  public itemClickHandler(
    viewManager: ViewManagerInterface,
    reversedIndex: number,
    ev: Event,
  ): void {
    stopEventFromActivatingCardWideActions(ev);

    const view = viewManager.getView();
    if (!view || !this._media?.length) {
      return;
    }

    viewManager.setViewByParameters({
      params: {
        view: 'media',
        queryResults: view.queryResults?.clone().selectIndex(
          // Media in the gallery is reversed vs the queryResults (see
          // note above).
          this._media.length - reversedIndex - 1,
        ),
      },
    });
  }
}
