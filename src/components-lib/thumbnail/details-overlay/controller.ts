import { format } from 'date-fns';

import type { CameraManager } from '../../../camera-manager/manager';
import { isTruthy } from '../../../utils/basic';
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
import { isIdentifiedByThumbnail } from '../is-identified-by-thumbnail';
import type { ResolvedThumbnailDetailsStyle } from '../resolve-details-style';
import { getThumbnailTier, type ThumbnailTier } from '../tier';

export interface ThumbnailDetailsOverlayOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
  detailsStyle?: ResolvedThumbnailDetailsStyle;
  size?: number;
}

interface ThumbnailDetailsOverlayTime {
  hoursMinutes: string;

  // Dropped where the overlay has only one line to give the time.
  seconds?: string;
}

export class ThumbnailDetailsOverlayController {
  private _tier: ThumbnailTier = 'standard';

  private _isHover = false;

  private _label: string | null = null;
  private _isInProgress = false;
  private _startTime: Date | null = null;
  private _duration: string | null = null;
  private _cameraTitle: string | null = null;
  private _where: string | null = null;
  private _tags: string | null = null;

  public calculate(options: ThumbnailDetailsOverlayOptions): void {
    this._tier = getThumbnailTier(options.size);

    // Hover if that's the configured style and the thumbnail alone is
    // sufficient to identify the distinction between neighboring items.
    this._isHover =
      options.detailsStyle === 'hover' && isIdentifiedByThumbnail(options.item);

    if (options.detailsStyle !== 'overlay' && options.detailsStyle !== 'hover') {
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
    this._duration = getMediaDuration(options.item);
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

  // The two smallest permanent overlays give the label and the time a single
  // shared line. A hover overlay grows taller instead, so it always has room
  // for both.
  public isOneLineHeadline(): boolean {
    return !this._isHover && (this._tier === 'compact' || this._tier === 'standard');
  }

  public getCornerLabel(): string | null {
    return this._isLabelInCorner() ? this._label : null;
  }

  public getHeadlineLabel(): string | null {
    return this._isLabelInCorner() ? null : this._label;
  }

  // Place the label in the corner when a compact overlay is permanently on
  // screen and the item has a time: its single line fits either the label or
  // the time, not both. A hover overlay grows tall enough to show them on
  // separate lines.
  private _isLabelInCorner(): boolean {
    return this._tier === 'compact' && !this._isHover && !!this._startTime;
  }

  public getTime(): ThumbnailDetailsOverlayTime | null {
    if (!this._startTime) {
      return null;
    }

    // Seconds need a line the label is not also using.
    const showSeconds = !this.isOneLineHeadline();
    return {
      hoursMinutes: format(this._startTime, 'HH:mm'),
      ...(showSeconds && { seconds: format(this._startTime, ':ss') }),
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
