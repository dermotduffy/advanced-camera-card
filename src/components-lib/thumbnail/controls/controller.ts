import { localize } from '../../../localize/localize';
import { isHoverableDevice } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import type { ViewItemCapabilities } from '../../../view/types';
import { isMediaReviewed } from '../../media/format';
import { getThumbnailTier } from '../tier';

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
}

export class ThumbnailControlsController {
  private _controls: ThumbnailControl[] = [];

  // The info control alone, at a size a finger can hit.
  private _isSingleControl = false;

  public calculate(options: ThumbnailControlsOptions): void {
    const controls = this._calculateControls(options);

    // Without a pointer a control has to be 44px to be hittable, and only from
    // the comfortable tier up is there room for one: at 75px it would cover a
    // third of the thumbnail. The info control takes that slot (and the other
    // controls are accessible from the popup).
    const tier = getThumbnailTier(options.size);
    const hasRoomForAFinger = tier === 'comfortable' || tier === 'poster';

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

    if (options.showInfoControl && ViewItemClassifier.isMedia(options.item)) {
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

  public isSingleControl(): boolean {
    return this._isSingleControl;
  }
}
