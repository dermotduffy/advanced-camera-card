import { format } from 'date-fns';

import type { CameraManager } from '../../../camera-manager/manager';
import type { Severity } from '../../../severity';
import { isTruthy } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaSeverity,
  getMediaTags,
  getMediaWhere,
  isMediaReviewed,
} from '../../media/format';
import { isIdentifiedByThumbnail } from '../is-identified-by-thumbnail';
import type { ResolvedThumbnailDetailsStyle } from '../resolve-details-style';
import { getThumbnailTier, type ThumbnailTier } from '../tier';

export type ThumbnailReviewState = 'reviewed' | 'unreviewed';

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

const JOINER = ' · ';

const join = (...parts: (string | null | undefined)[]): string | null =>
  parts.filter(isTruthy).join(JOINER) || null;

export class ThumbnailDetailsOverlayController {
  private _tier: ThumbnailTier = 'standard';

  private _isHover = false;

  private _label: string | null = null;
  private _reviewState: ThumbnailReviewState | null = null;
  private _isInProgress = false;
  private _severity: Severity | null = null;
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
      this._reviewState = null;
      this._isInProgress = false;
      this._severity = null;
      this._startTime = null;
      this._duration = null;
      this._cameraTitle = null;
      this._where = null;
      this._tags = null;
      return;
    }

    this._label = getMediaLabel(options.cameraManager, options.item);
    const isReviewed = isMediaReviewed(options.item);
    this._reviewState =
      isReviewed === null ? null : isReviewed ? 'reviewed' : 'unreviewed';

    this._isInProgress =
      ViewItemClassifier.isMedia(options.item) && options.item.inProgress() === true;
    this._severity = getMediaSeverity(options.item);
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

  public getSeverity(): Severity | null {
    return this._severity;
  }

  public getReviewState(): ThumbnailReviewState | null {
    return this._reviewState;
  }

  public isInProgress(): boolean {
    return this._isInProgress;
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

    // The two smallest tiers share one line between the label and the time --
    // omit the seconds.
    const showSeconds =
      this._isHover || this._tier === 'comfortable' || this._tier === 'poster';
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
        ? [join(this._duration, camera, this._where), this._tags]
        : this._tier === 'comfortable'
          ? this._isHover
            ? [this._duration, join(camera, this._where), this._tags]
            : [join(this._duration, camera)]
          : this._tier === 'standard' && this._isHover
            ? [join(this._duration, camera)]
            : [];

    return details.filter(isTruthy);
  }
}
