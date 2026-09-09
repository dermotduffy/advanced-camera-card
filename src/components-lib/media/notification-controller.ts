import type { CameraManager } from '../../camera-manager/manager';
import type { ViewItemManager } from '../../card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../card-controller/view/types';
import type {
  InternalNotification,
  InternalNotificationControl,
} from '../../config/schema/actions/types';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { createInternalCallbackAction } from '../../utils/action';
import {
  downloadMedia,
  navigateToTimeline,
  toggleFavorite,
  toggleReviewed,
} from '../../utils/media-actions';
import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import type { ViewItemCapabilities } from '../../view/types';
import { getMediaDetails, getMediaHeading, type MediaDetail } from './detail';

export interface NotificationControlsContext {
  hass?: HomeAssistant;
  viewItemManager?: ViewItemManager;
  viewManagerEpoch?: ViewManagerEpoch;
  capabilities?: ViewItemCapabilities | null;

  // Whether to filter {reviewed/unreviewed, favorite/non-favorite} items after
  // changing the reviewed state.
  filterReviewed?: boolean;
  filterFavorite?: boolean;
}

export class MediaNotificationController {
  private _metadata: MediaDetail[] = [];
  private _heading: MediaDetail | null = null;
  private _item: ViewItem | null = null;

  public calculate(cameraManager?: CameraManager, item?: ViewItem, seek?: Date): void {
    this._item = item ?? null;

    this._heading = getMediaHeading(cameraManager, item);
    this._metadata = getMediaDetails(cameraManager, item, seek);
  }

  public getNotification(context?: NotificationControlsContext): InternalNotification {
    const description = ViewItemClassifier.isMedia(this._item)
      ? this._item.getDescription()
      : null;

    return {
      heading: this._heading ?? undefined,
      controls: context ? this._getControls(context) : undefined,
      metadata: this._metadata,
      body: description ? { text: description } : undefined,
    };
  }

  private _getControls(
    context: NotificationControlsContext,
  ): InternalNotificationControl[] {
    const controls: InternalNotificationControl[] = [];
    const item = this._item;

    if (!item) {
      return controls;
    }

    if (ViewItemClassifier.isReview(item)) {
      const isReviewed = item.isReviewed();
      controls.push({
        tooltip: isReviewed
          ? localize('common.set_reviews.unreviewed')
          : localize('common.set_reviews.reviewed'),
        icon: isReviewed ? 'mdi:check-circle' : 'mdi:check-circle-outline',
        ...(isReviewed && { className: 'reviewed' }),
        actions: {
          tap_action: createInternalCallbackAction(async (api) => {
            const success = await toggleReviewed(
              api.getCardElementManager().getElement(),
              item,
              context.viewItemManager,
              context.viewManagerEpoch,
              context.filterReviewed,
            );
            if (success) {
              api
                .getNotificationManager()
                .setNotification(this.getNotification(context));
            }
          }),
        },
        dismiss: false,
      });
    }

    if (context.capabilities?.canFavorite && ViewItemClassifier.isMedia(item)) {
      const isFavorite = item.isFavorite();
      controls.push({
        tooltip: localize('thumbnail.retain_indefinitely'),
        icon: isFavorite ? 'mdi:star' : 'mdi:star-outline',
        ...(isFavorite && { className: 'favorited' }),
        actions: {
          tap_action: createInternalCallbackAction(async (api) => {
            const success = await toggleFavorite(
              item,
              context.viewItemManager,
              context.viewManagerEpoch,
              context.filterFavorite,
            );
            if (success) {
              api
                .getNotificationManager()
                .setNotification(this.getNotification(context));
            }
          }),
        },
        dismiss: false,
      });
    }

    if (context.capabilities?.canDownload && item.getID()) {
      controls.push({
        tooltip: localize('thumbnail.download'),
        icon: 'mdi:download',
        dismiss: true,
        actions: {
          tap_action: createInternalCallbackAction(async () => {
            await downloadMedia(item, context.viewItemManager);
          }),
        },
      });
    }

    if (ViewItemClassifier.supportsTimeline(item) && context.viewManagerEpoch) {
      controls.push({
        tooltip: localize('thumbnail.timeline'),
        icon: 'mdi:target',
        dismiss: true,
        actions: {
          tap_action: createInternalCallbackAction(async () => {
            navigateToTimeline(item, context.viewManagerEpoch);
          }),
        },
      });
    }

    return controls;
  }
}
