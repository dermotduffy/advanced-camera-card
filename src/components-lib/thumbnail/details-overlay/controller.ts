import { format } from 'date-fns';

import type { CameraManager } from '../../../camera-manager/manager';
import { THUMBNAIL_SIZE_DEFAULT } from '../../../config/schema/common/controls/thumbnails';
import type { Severity } from '../../../severity';
import { isTruthy } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaTags,
  getMediaWhere,
} from '../../media/format';
import type { ResolvedThumbnailDetailsStyle } from '../resolve-details-style';

export type ThumbnailDetailsOverlayTier =
  | 'compact'
  | 'standard'
  | 'comfortable'
  | 'poster';

const TIER_SIZE_MIN: Record<Exclude<ThumbnailDetailsOverlayTier, 'compact'>, number> = {
  standard: 100,
  comfortable: 175,
  poster: 250,
};

interface ThumbnailDetailsOverlayTime {
  hoursMinutes: string;

  // Dropped where the overlay has only one line to give the time.
  seconds?: string;
}

const JOINER = ' · ';

const join = (...parts: (string | null | undefined)[]): string | null =>
  parts.filter(isTruthy).join(JOINER) || null;

export class ThumbnailDetailsOverlayController {
  private _tier: ThumbnailDetailsOverlayTier = 'standard';

  private _isHover = false;

  private _label: string | null = null;
  private _severity: Severity | null = null;
  private _startTime: Date | null = null;
  private _duration: string | null = null;
  private _cameraTitle: string | null = null;
  private _where: string | null = null;
  private _tags: string | null = null;

  public calculate(
    cameraManager?: CameraManager | null,
    item?: ViewItem,
    detailsStyle?: ResolvedThumbnailDetailsStyle,
    size: number = THUMBNAIL_SIZE_DEFAULT,
  ): void {
    this._tier =
      size >= TIER_SIZE_MIN.poster
        ? 'poster'
        : size >= TIER_SIZE_MIN.comfortable
          ? 'comfortable'
          : size >= TIER_SIZE_MIN.standard
            ? 'standard'
            : 'compact';

    this._isHover = detailsStyle === 'hover';

    if (detailsStyle !== 'overlay' && detailsStyle !== 'hover') {
      this._label = null;
      this._severity = null;
      this._startTime = null;
      this._duration = null;
      this._cameraTitle = null;
      this._where = null;
      this._tags = null;
      return;
    }

    this._label = getMediaLabel(cameraManager, item);
    this._severity = ViewItemClassifier.isReview(item) ? item.getSeverity() : null;
    this._startTime = ViewItemClassifier.isMedia(item) ? item.getStartTime() : null;
    this._duration = getMediaDuration(item);
    this._cameraTitle = getMediaCameraTitle(cameraManager, item);
    this._where = getMediaWhere(item);
    this._tags = getMediaTags(item);
  }

  public getTier(): ThumbnailDetailsOverlayTier {
    return this._tier;
  }

  public getSeverity(): Severity | null {
    return this._severity;
  }

  public getLabel(): string | null {
    return this._label;
  }

  /**
   * The smallest permanent overlay fits one value, and the time is the one that
   * tells otherwise identical thumbnails apart.
   * @returns `true` if the label goes in a corner of the thumbnail instead.
   */
  public isLabelInCorner(): boolean {
    return this._tier === 'compact' && !this._isHover;
  }

  public getTime(): ThumbnailDetailsOverlayTime | null {
    if (!this._startTime) {
      return null;
    }

    const showSeconds = this._isHover || this._tier !== 'compact';
    return {
      hoursMinutes: format(this._startTime, 'HH:mm'),
      ...(showSeconds && { seconds: format(this._startTime, ':ss') }),
    };
  }

  /**
   * @returns The values below the headline row, one per line, in display order.
   */
  public getRows(): string[] {
    // Don't repeat data in the overlay.
    const camera = this._cameraTitle === this._label ? null : this._cameraTitle;

    // A hover overlay is allowed carry more data (since it covers the thumbnail
    // temporarily).
    const rows =
      this._tier === 'poster'
        ? [join(this._duration, camera, this._where), this._tags]
        : this._tier === 'comfortable'
          ? this._isHover
            ? [this._duration, join(camera, this._where), this._tags]
            : [join(this._duration, camera)]
          : this._tier === 'standard' && this._isHover
            ? [join(this._duration, camera)]
            : [];

    return rows.filter(isTruthy);
  }
}
