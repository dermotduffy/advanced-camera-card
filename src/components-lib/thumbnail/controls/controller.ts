import { localize } from '../../../localize/localize';
import { isHoverableDevice } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import type { ViewItemCapabilities } from '../../../view/types';
import { isMediaReviewed } from '../../media/format';
import type { ResolvedThumbnailDetailsStyle } from '../resolve-details-style';
import { getThumbnailTier, type ThumbnailTier } from '../tier';

type ThumbnailControlName = 'review' | 'favorite' | 'info' | 'timeline' | 'download';

export interface ThumbnailControl {
  name: ThumbnailControlName;
  icon: string;
  title: string;

  // Current state of the control (if any).
  active?: boolean;
}

export interface ThumbnailControlsOptions {
  item?: ViewItem;
  capabilities?: ViewItemCapabilities;

  size?: number;

  showFavoriteControl?: boolean;
  showTimelineControl?: boolean;
  showDownloadControl?: boolean;
  showReviewControl?: boolean;
  showInfoControl?: boolean;

  detailsStyle?: ResolvedThumbnailDetailsStyle;
}

export class ThumbnailControlsController {
  private _tier: ThumbnailTier = 'standard';
  private _controls: ThumbnailControl[] = [];

  // The info control alone, at a size a finger can hit.
  private _isSingleControl = false;

  public calculate(options: ThumbnailControlsOptions): void {
    const controls = this._calculateControls(options);

    // A touch device shows only the info control, and only where a finger-sized
    // target fits. The popup carries the other controls.
    this._tier = getThumbnailTier(options.size);
    const hasRoomForAFinger = this._tier !== 'compact';

    this._isSingleControl =
      !isHoverableDevice() &&
      hasRoomForAFinger &&
      controls.some((control) => control.name === 'info');

    if (this._isSingleControl) {
      this._controls = controls.filter((control) => control.name === 'info');
    } else {
      this._controls = isHoverableDevice() ? controls : [];
    }
  }

  private _calculateControls(options: ThumbnailControlsOptions): ThumbnailControl[] {
    const controls: ThumbnailControl[] = [];
    if (!options.item) {
      return controls;
    }

    const isReviewed = isMediaReviewed(options.item);
    if (options.showReviewControl && isReviewed !== null) {
      controls.push({
        name: 'review',
        icon: isReviewed ? 'mdi:check-circle' : 'mdi:check-circle-outline',
        title: isReviewed
          ? localize('common.set_reviews.unreviewed')
          : localize('common.set_reviews.reviewed'),
        active: isReviewed,
      });
    } else if (
      options.showFavoriteControl &&
      options.capabilities?.canFavorite &&
      ViewItemClassifier.isMedia(options.item)
    ) {
      const isFavorite = options.item.isFavorite() === true;
      controls.push({
        name: 'favorite',
        icon: isFavorite ? 'mdi:star' : 'mdi:star-outline',
        title: localize('thumbnail.retain_indefinitely'),
        active: isFavorite,
      });
    }

    if (
      options.showInfoControl &&
      // Don't show 'i' when the panel already has the media information.
      options.detailsStyle !== 'panel' &&
      ViewItemClassifier.isMedia(options.item)
    ) {
      controls.push({
        name: 'info',
        icon: 'mdi:information-outline',
        title: options.item.getDescription() ?? '',
      });
    }

    if (
      options.showTimelineControl &&
      ViewItemClassifier.supportsTimeline(options.item)
    ) {
      controls.push({
        name: 'timeline',
        icon: 'mdi:target',
        title: localize('thumbnail.timeline'),
      });
    }

    if (
      options.showDownloadControl &&
      options.capabilities?.canDownload &&
      options.item.getID()
    ) {
      controls.push({
        name: 'download',
        icon: 'mdi:download',
        title: localize('thumbnail.download'),
      });
    }

    return controls;
  }

  public getControls(): ThumbnailControl[] {
    return this._controls;
  }

  public getTier(): ThumbnailTier {
    return this._tier;
  }

  public isSingleControl(): boolean {
    return this._isSingleControl;
  }
}
