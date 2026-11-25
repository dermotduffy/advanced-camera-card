import type { CameraManager } from '../../../camera-manager/manager';
import { isTruthy } from '../../../utils/basic';
import { formatTime, formatTimeToParts } from '../../../utils/date/localized';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaTags,
  getMediaWhere,
  joinValues,
} from '../../media/format';
import type { ResolvedThumbnailStyle } from '../resolve-style';
import { THUMBNAIL_TIER_DEFAULT, type ThumbnailTier } from '../tier';

export interface ThumbnailDetailsOverlayOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
  thumbnailStyle?: ResolvedThumbnailStyle;
  tier?: ThumbnailTier;
}

interface ThumbnailDetailsOverlayTime {
  // The time shown in the headline, as typed pieces. These include a `second`
  // piece only when `isOneLineHeadline()` is false, since a one-line headline
  // has no room for seconds.
  parts: Intl.DateTimeFormatPart[];

  // The full time, with seconds.
  tooltip: string;
}

export class ThumbnailDetailsOverlayController {
  private _tier: ThumbnailTier = THUMBNAIL_TIER_DEFAULT;

  private _isHover = false;

  private _label: string | null = null;
  private _isInProgress = false;
  private _startTime: Date | null = null;
  private _duration: string | null = null;
  private _cameraTitle: string | null = null;
  private _where: string | null = null;
  private _tags: string | null = null;

  public calculate(options: ThumbnailDetailsOverlayOptions): void {
    this._tier = options.tier ?? THUMBNAIL_TIER_DEFAULT;

    this._isHover = options.thumbnailStyle === 'hover';

    if (options.thumbnailStyle !== 'overlay' && options.thumbnailStyle !== 'hover') {
      this._label = null;
      this._isInProgress = false;
      this._startTime = null;
      this._duration = null;
      this._cameraTitle = null;
      this._where = null;
      this._tags = null;
      return;
    }

    this._label = getMediaLabel(options.cameraManager, options.item);

    this._isInProgress =
      ViewItemClassifier.isMedia(options.item) && options.item.inProgress() === true;
    this._startTime = ViewItemClassifier.isMedia(options.item)
      ? options.item.getStartTime()
      : null;
    this._duration = getMediaDuration(options.item, { excludeInProgress: true });
    this._cameraTitle = getMediaCameraTitle(options.cameraManager, options.item);
    this._where = getMediaWhere(options.item);
    this._tags = getMediaTags(options.item);
  }

  public getTier(): ThumbnailTier {
    return this._tier;
  }

  public isHover(): boolean {
    return this._isHover;
  }

  public isInProgress(): boolean {
    return this._isInProgress;
  }

  public isOneLineHeadline(): boolean {
    return this._tier === 'compact' || this._tier === 'standard';
  }

  public getCornerLabel(): string | null {
    return this._isLabelInCorner() ? this._label : null;
  }

  public getHeadlineLabel(): string | null {
    return this._isLabelInCorner() ? null : this._label;
  }

  // The compact tier's single line fits either the label or the time, not both,
  // so the overlay style moves the label to the corner. The hover style (when
  // hovered) shares the line instead, since the control row covers that edge
  // as it appears.
  private _isLabelInCorner(): boolean {
    return this._tier === 'compact' && !this._isHover && !!this._startTime;
  }

  public getTime(): ThumbnailDetailsOverlayTime | null {
    if (!this._startTime) {
      return null;
    }

    return {
      parts: formatTimeToParts(this._startTime, { seconds: !this.isOneLineHeadline() }),
      tooltip: formatTime(this._startTime, { seconds: true }),
    };
  }

  /**
   * @returns The details below the headline, one per line, in display order.
   */
  public getDetails(): string[] {
    // Don't repeat data in the overlay.
    const camera = this._cameraTitle === this._label ? null : this._cameraTitle;

    // A hover overlay is allowed to carry more data (since it covers the
    // thumbnail temporarily).
    const details =
      this._tier === 'poster'
        ? [joinValues(this._duration, camera, this._where), this._tags]
        : this._tier === 'comfortable'
          ? this._isHover
            ? [this._duration, joinValues(camera, this._where), this._tags]
            : [joinValues(this._duration, camera)]
          : this._tier === 'standard' && this._isHover
            ? [joinValues(this._duration, camera)]
            : [];

    return details.filter(isTruthy);
  }
}
