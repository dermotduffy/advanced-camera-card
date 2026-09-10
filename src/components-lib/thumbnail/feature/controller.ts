import { format } from 'date-fns';

import type { CameraManager } from '../../../camera-manager/manager';
import type { CameraManagerCameraMetadata } from '../../../camera-manager/types';
import {
  brandsUrl,
  extractDomainFromBrandUrl,
  isBrandUrl,
} from '../../../ha/brands-url';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { isIdentifiedByThumbnail } from '../is-identified-by-thumbnail';
import type { ResolvedThumbnailDetailsStyle } from '../resolve-details-style';

export interface ThumbnailFeatureOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
  detailsStyle?: ResolvedThumbnailDetailsStyle;
}

export class ThumbnailFeatureController {
  private _title: string | null = null;
  private _subtitles: string[] = [];
  private _icon: string | null = null;
  private _thumbnail: string | null = null;
  private _thumbnailClass: string | null = null;

  public calculate(options: ThumbnailFeatureOptions): void {
    const cameraID = ViewItemClassifier.isMedia(options.item)
      ? options.item.getCameraID()
      : null;
    const cameraMetadata = cameraID
      ? options.cameraManager?.getCameraMetadata(cameraID) ?? null
      : null;

    this._calculateVisuals(cameraMetadata, options);
    this._calculateTitles(cameraMetadata, options);
  }

  private _calculateTitles(
    cameraMetadata: CameraManagerCameraMetadata | null,
    options: ThumbnailFeatureOptions,
  ): void {
    const hasDetails = !!options.detailsStyle && options.detailsStyle !== 'none';

    // If there are details being rendered, or the thumbnail is itself
    // sufficient to distinguish items, there is no need to render additional
    // titles.
    if (hasDetails || isIdentifiedByThumbnail(options.item)) {
      this._title = null;
      this._subtitles = [];
      return;
    }

    const startTime =
      ViewItemClassifier.isEvent(options.item) ||
      ViewItemClassifier.isRecording(options.item)
        ? options.item.getStartTime()
        : null;

    this._title = startTime ? format(startTime, 'HH:mm') : null;

    const day = startTime ? format(startTime, 'MMM do') : null;
    const itemTitle = options.item?.getTitle() ?? null;
    const src = cameraMetadata?.title ?? itemTitle ?? null;

    this._subtitles = [...(day ? [day] : []), ...(src ? [src] : [])];
  }

  private _calculateVisuals(
    cameraMetadata: CameraManagerCameraMetadata | null,
    options: ThumbnailFeatureOptions,
  ): void {
    let thumbnail: string | null = options.item?.getThumbnail() ?? null;
    if (thumbnail && isBrandUrl(thumbnail)) {
      thumbnail = brandsUrl({
        domain: extractDomainFromBrandUrl(thumbnail),
        type: 'icon',
        useFallback: true,
        brand: true,
      });
    }

    if (thumbnail) {
      this._thumbnail = thumbnail;
      this._icon = null;
      // Treat as a placeholder (centered, contain-fit) when either the URL
      // looks brand-like, or Home Assistant reported the thumbnail for a
      // folder. The folder check is necessary because HA's media browser often
      // returns folder thumbnails as local/proxy URLs that don't match
      // isBrandUrl, even though they visually represent integration logos. A
      // thumbnail set by the folder configuration (via the thumbnail parser) is
      // an image of the folder contents, and so is not a placeholder.
      const isFolderLogo =
        ViewItemClassifier.isFolder(options.item) &&
        !options.item.isThumbnailConfigured();
      this._thumbnailClass =
        isBrandUrl(thumbnail) || isFolderLogo ? 'placeholder' : null;
    } else {
      this._thumbnail = null;
      this._thumbnailClass = null;
      this._icon = options.item?.getIcon() ?? cameraMetadata?.engineIcon ?? null;
    }
  }

  public getTitle(): string | null {
    return this._title;
  }

  public getSubtitles(): string[] {
    return this._subtitles;
  }

  public getIcon(): string | null {
    return this._icon;
  }

  public getThumbnail(): string | null {
    return this._thumbnail;
  }

  public getThumbnailClass(): string | null {
    return this._thumbnailClass;
  }
}
