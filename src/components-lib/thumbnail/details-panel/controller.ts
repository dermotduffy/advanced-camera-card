import type { CameraManager } from '../../../camera-manager/manager';
import type { ViewItem } from '../../../view/item';
import { getMediaDetails, getMediaHeading, type MediaDetail } from '../../media/detail';
import { getThumbnailTier, type ThumbnailTier } from '../tier';

// The rows the panel shows, heading included. Each tier's `line-height` and
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

export class ThumbnailDetailsPanelController {
  private _tier: ThumbnailTier = 'standard';
  private _heading: MediaDetail | null = null;
  private _rows: MediaDetail[] = [];
  private _hiddenRowCount = 0;

  public calculate(
    cameraManager?: CameraManager,
    item?: ViewItem,
    seek?: Date,
    size?: number,
    showInfoControl = false,
  ): void {
    this._tier = getThumbnailTier(size);
    this._heading = getMediaHeading(cameraManager, item);

    const allDetails = getMediaDetails(cameraManager, item, seek);
    const lines = LINES_BY_TIER[this._tier] - (this._heading ? 1 : 0);

    if (allDetails.length <= lines) {
      this._rows = allDetails;
      this._hiddenRowCount = 0;
      return;
    }

    // The  "More details" chip (that opens the "info" notification) takes a
    // line of its own. Without the info control there is no popup to open, so
    // no chip and no line for it.
    this._rows = allDetails.slice(0, Math.max(showInfoControl ? lines - 1 : lines, 0));
    this._hiddenRowCount = showInfoControl ? allDetails.length - this._rows.length : 0;
  }

  public getTier(): ThumbnailTier {
    return this._tier;
  }

  public getHeading(): MediaDetail | null {
    return this._heading;
  }

  public getRows(): MediaDetail[] {
    return this._rows;
  }

  /**
   * @returns How many rows the panel had no room for, or `0` if they all fit or
   * there is no info control to open the popup with.
   */
  public getHiddenRowCount(): number {
    return this._hiddenRowCount;
  }
}
