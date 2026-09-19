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

  // Full time (for the tooltip).
  hoursMinutesSeconds: string;
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

    this._isHover = options.detailsStyle === 'hover';

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

    const hoursMinutesSeconds = format(this._startTime, 'HH:mm:ss');
    const showSeconds = !this.isOneLineHeadline();
    return {
      hoursMinutes: hoursMinutesSeconds.slice(0, 5),
      ...(showSeconds && { seconds: hoursMinutesSeconds.slice(5) }),
      hoursMinutesSeconds,
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
