import type { CameraManager } from '../../../camera-manager/manager';
import type { CameraManagerCameraMetadata } from '../../../camera-manager/types';
import {
  brandsUrl,
  extractDomainFromBrandUrl,
  isBrandUrl,
} from '../../../ha/brands-url';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';

export interface ThumbnailFeatureOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
}

export class ThumbnailFeatureController {
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
