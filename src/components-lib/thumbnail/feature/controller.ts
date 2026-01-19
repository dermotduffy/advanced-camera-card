import { format } from 'date-fns';
import { CameraManager } from '../../../camera-manager/manager';
import { CameraManagerCameraMetadata } from '../../../camera-manager/types';
import {
  brandsUrl,
  extractDomainFromBrandUrl,
  isBrandUrl,
} from '../../../ha/brands-url';
import { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';

export class ThumbnailFeatureController {
  private _title: string | null = null;
  private _subtitles: string[] = [];
  private _icon: string | null = null;
  private _thumbnail: string | null = null;
  private _thumbnailClass: string | null = null;

  public calculate(
    cameraManager?: CameraManager | null,
    item?: ViewItem,
    hasDetails?: boolean,
  ): void {
    const cameraID = ViewItemClassifier.isMedia(item) ? item.getCameraID() : null;
    const cameraMetadata = cameraID
      ? cameraManager?.getCameraMetadata(cameraID) ?? null
      : null;

    this._calculateVisuals(cameraMetadata, item);
    this._calculateTitles(cameraMetadata, item, hasDetails);
  }

  private _calculateTitles(
    cameraMetadata?: CameraManagerCameraMetadata | null,
    item?: ViewItem,
    hasDetails?: boolean,
  ) {
    if (hasDetails) {
      return;
    }

    if (this._thumbnail && ViewItemClassifier.isMedia(item)) {
      this._title = null;
      this._subtitles = [];
      return;
    }

    const startTime =
      ViewItemClassifier.isEvent(item) || ViewItemClassifier.isRecording(item)
        ? item.getStartTime()
        : null;

    this._title = startTime ? format(startTime, 'HH:mm') : null;

    const day = startTime ? format(startTime, 'MMM do') : null;
    const itemTitle = item?.getTitle() ?? null;
    const src = cameraMetadata?.title ?? itemTitle ?? null;

    this._subtitles = [...(day ? [day] : []), ...(src ? [src] : [])];
  }

  private _calculateVisuals(
    cameraMetadata?: CameraManagerCameraMetadata | null,
    item?: ViewItem,
  ) {
    let thumbnail: string | null = item?.getThumbnail() ?? null;
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
      this._thumbnailClass = isBrandUrl(thumbnail) ? 'placeholder' : null;
    } else {
      this._thumbnail = null;
      this._thumbnailClass = null;
      this._icon = item?.getIcon() ?? cameraMetadata?.engineIcon ?? null;
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
