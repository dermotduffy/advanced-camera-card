import { localize } from '../../../localize/localize';
import { isHoverableDevice } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import type { ViewItemCapabilities } from '../../../view/types';
import { isMediaReviewed } from '../../media/format';
import type { ResolvedThumbnailStyle } from '../resolve-style';
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

  thumbnailStyle?: ResolvedThumbnailStyle;
}

const TOUCH_CONTROL_CAPACITY: Record<ThumbnailTier, number> = {
  // A finger-sized control would reach the middle of a thumbnail this small.
  compact: 0,
  standard: 1,
  comfortable: 3,
  poster: 4,
};

const POINTER_CONTROL_CAPACITY: Record<ThumbnailTier, number> = {
  compact: 2,
  standard: 2,
  comfortable: 4,
  poster: 5,
};

export class ThumbnailControlsController {
  private _tier: ThumbnailTier = 'standard';
  private _controls: ThumbnailControl[] = [];

  private _isTouch = false;

  public calculate(options: ThumbnailControlsOptions): void {
    const controls = this._calculateControls(options);

    this._tier = getThumbnailTier(options.size);
    this._isTouch = !isHoverableDevice();
    this._controls = this._getControlsThatFit(
      controls,
      (this._isTouch ? TOUCH_CONTROL_CAPACITY : POINTER_CONTROL_CAPACITY)[this._tier],
    );
  }

  private _getControlsThatFit(
    controls: ThumbnailControl[],
    capacity: number,
  ): ThumbnailControl[] {
    if (capacity <= 0) {
      return [];
    }

    // The info control is the last one that is evicted due to space (since it
    // enables access to everything else).
    const info = controls.find((control) => control.name === 'info');
    const rest = controls.filter((control) => control.name !== 'info');
    const kept = new Set([
      ...(info ? [info] : []),
      ...rest.slice(0, Math.max(capacity - (info ? 1 : 0), 0)),
    ]);
    return controls.filter((control) => kept.has(control));
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
    }

    if (
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
      // The panel already carries the media information, so the 'i' is only
      // worth its space where it is also the way to reach the other controls.
      (options.thumbnailStyle !== 'panel' || !isHoverableDevice()) &&
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

  public isTouch(): boolean {
    return this._isTouch;
  }
}
