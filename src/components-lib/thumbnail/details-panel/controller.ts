import type { CameraManager } from '../../../camera-manager/manager';
import type { ViewItem } from '../../../view/item';
import {
  getMediaDetails,
  getMediaHeading,
  getMediaSeekDetail,
  type MediaDetail,
} from '../../media/detail';
import { getThumbnailTier, type ThumbnailTier } from '../tier';

// The lines the panel shows, heading included. Each tier's `line-height` and
// `row-gap` in `thumbnail-details-panel.scss` set the height of a row, and the
// panel is never taller than the thumbnail beside it, so the smaller tiers fit
// fewer. Seven is the most a media item has, so the two largest tiers are not
// limited by height.
const LINES_BY_TIER: Record<ThumbnailTier, number> = {
  compact: 3,
  standard: 4,
  comfortable: 7,
  poster: 7,
};

export interface ThumbnailDetailsPanelOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
  seek?: Date;
  size?: number;
  showInfoControl?: boolean;
}

export class ThumbnailDetailsPanelController {
  private _tier: ThumbnailTier = 'standard';
  private _heading: MediaDetail | null = null;
  private _details: MediaDetail[] = [];
  private _seekDetail: MediaDetail | null = null;
  private _hiddenDetailCount = 0;

  public calculate(options: ThumbnailDetailsPanelOptions): void {
    this._tier = getThumbnailTier(options.size);
    this._heading = getMediaHeading(options);
    this._seekDetail = getMediaSeekDetail(options.seek);

    const allDetails = getMediaDetails(options);
    const lines =
      LINES_BY_TIER[this._tier] - (this._heading ? 1 : 0) - (this._seekDetail ? 1 : 0);

    if (allDetails.length <= lines) {
      this._details = allDetails;
      this._hiddenDetailCount = 0;
      return;
    }

    // The  "More details" chip (that opens the "info" notification) takes a
    // line of its own. Without the info control there is no popup to open, so
    // no chip and no line for it.
    this._details = allDetails.slice(
      0,
      Math.max(options.showInfoControl ? lines - 1 : lines, 0),
    );
    this._hiddenDetailCount = options.showInfoControl
      ? allDetails.length - this._details.length
      : 0;
  }

  public getTier(): ThumbnailTier {
    return this._tier;
  }

  public getHeading(): MediaDetail | null {
    return this._heading;
  }

  public getDetails(): MediaDetail[] {
    return this._details;
  }

  // Kept separate from the details so it avoids truncation.
  public getSeekDetail(): MediaDetail | null {
    return this._seekDetail;
  }

  /**
   * @returns How many details the panel had no room for, or `0` if they all
   * fit or there is no info control to open the popup with.
   */
  public getHiddenDetailCount(): number {
    return this._hiddenDetailCount;
  }
}
