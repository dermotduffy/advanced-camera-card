import { format } from 'date-fns';
import { CameraManager } from '../../camera-manager/manager';
import { CameraManagerCameraMetadata } from '../../camera-manager/types';
import { ViewItemManager } from '../../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../../card-controller/view/types';
import {
  Notification,
  NotificationControl,
  NotificationDetail,
} from '../../config/schema/actions/types';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { createInternalCallbackAction } from '../../utils/action';
import { getDurationString, prettifyTitle } from '../../utils/basic';
import {
  downloadMedia,
  navigateToTimeline,
  toggleFavorite,
  toggleReviewed,
} from '../../utils/media-actions';
import { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { ViewItemCapabilities } from '../../view/types';

export interface NotificationControlsContext {
  hass?: HomeAssistant;
  viewItemManager?: ViewItemManager;
  viewManagerEpoch?: ViewManagerEpoch;
  capabilities?: ViewItemCapabilities | null;

  // Whether to filter reviewed/unreviewed items after changing the reviewed
  // state.
  filterReviewed?: boolean;
}

export class MediaDetailsController {
  private _details: NotificationDetail[] = [];
  private _heading: NotificationDetail | null = null;
  private _item: ViewItem | null = null;

  public calculate(
    cameraManager?: CameraManager | null,
    item?: ViewItem,
    seek?: Date,
  ): void {
    this._item = item ?? null;
    const cameraID = ViewItemClassifier.isMedia(item) ? item.getCameraID() : null;
    const cameraMetadata = cameraID
      ? cameraManager?.getCameraMetadata(cameraID) ?? null
      : null;

    this._calculateHeading(cameraMetadata, item);
    this._calculateDetails(cameraMetadata, item, seek);
  }

  private _calculateHeading(
    cameraMetadata: CameraManagerCameraMetadata | null,
    item?: ViewItem,
  ): void {
    if (ViewItemClassifier.isEvent(item)) {
      const what = prettifyTitle(item.getWhat()?.join(', ')) ?? null;
      const tags = prettifyTitle(item.getTags()?.join(', ')) ?? null;
      const whatWithTags =
        what || tags ? (what ?? '') + (what && tags ? ': ' : '') + (tags ?? '') : null;
      const rawScore = item.getScore();
      const score = rawScore ? (rawScore * 100).toFixed(2) + '%' : null;

      this._heading = whatWithTags
        ? { text: `${whatWithTags}${score ? ` ${score}` : ''}` }
        : null;
      return;
    }

    if (ViewItemClassifier.isReview(item)) {
      const title = item.getTitle();
      const severity = item.getSeverity();

      this._heading = title
        ? {
            text: title,
            severity: severity ?? undefined,
            tooltip:
              localize('common.severity') +
              ': ' +
              localize('common.severities.' + severity),
            icon: 'mdi:circle-medium',
          }
        : null;
      return;
    }

    if (cameraMetadata?.title) {
      this._heading = {
        text: cameraMetadata.title,
      };
      return;
    }

    this._heading = null;
  }

  private _calculateDetails(
    cameraMetadata: CameraManagerCameraMetadata | null,
    item?: ViewItem,
    seek?: Date,
  ): void {
    const itemTitle = item?.getTitle() ?? null;

    const startTime = ViewItemClassifier.isMedia(item) ? item.getStartTime() : null;
    const endTime = ViewItemClassifier.isMedia(item) ? item.getEndTime() : null;
    const duration = startTime && endTime ? getDurationString(startTime, endTime) : null;
    const inProgress = ViewItemClassifier.isMedia(item)
      ? item.inProgress()
        ? localize('thumbnail.in_progress')
        : null
      : null;
    const where = ViewItemClassifier.isMedia(item)
      ? prettifyTitle(item?.getWhere()?.join(', ')) ?? null
      : null;
    const tags = ViewItemClassifier.isEvent(item)
      ? prettifyTitle(item?.getTags()?.join(', ')) ?? null
      : null;
    const seekString = seek ? format(seek, 'HH:mm:ss') : null;

    const details = [
      ...(startTime
        ? [
            {
              tooltip: localize('thumbnail.start'),
              icon: 'mdi:calendar-clock-outline',
              text: format(startTime, 'yyyy-MM-dd HH:mm:ss'),
            },
          ]
        : []),
      ...(duration || inProgress
        ? [
            {
              tooltip: localize('thumbnail.duration'),
              icon: 'mdi:clock-outline',
              text: `${duration ?? ''}${duration && inProgress ? ' ' : ''}${inProgress ?? ''}`,
            },
          ]
        : []),
      ...(cameraMetadata?.title
        ? [
            {
              tooltip: localize('thumbnail.camera'),
              text: cameraMetadata.title,
              icon: 'mdi:cctv',
            },
          ]
        : []),
      ...(where
        ? [
            {
              tooltip: localize('thumbnail.where'),
              text: where,
              icon: 'mdi:map-marker-outline',
            },
          ]
        : []),
      ...(tags
        ? [
            {
              tooltip: localize('thumbnail.tag'),
              text: tags,
              icon: 'mdi:tag',
            },
          ]
        : []),
      ...(seekString
        ? [
            {
              tooltip: localize('thumbnail.seek'),
              text: seekString,
              icon: 'mdi:clock-fast',
            },
          ]
        : []),
    ];

    // To avoid duplication, if the event has a starttime, the title is omitted
    // from the details.
    const includeTitle =
      (!ViewItemClassifier.isEvent(item) && !ViewItemClassifier.isReview(item)) ||
      !startTime;
    this._details = [
      ...(includeTitle && itemTitle
        ? [
            {
              text: itemTitle,
              ...(details.length > 0 && {
                icon: 'mdi:rename',
                tooltip: localize('thumbnail.title'),
              }),
            },
          ]
        : []),
      ...details,
    ];
  }

  public getHeading(): NotificationDetail | null {
    return this._heading;
  }

  public getDetails(): NotificationDetail[] {
    return this._details;
  }

  public getNotification(context?: NotificationControlsContext): Notification {
    return {
      heading: this._heading ?? undefined,
      controls: context ? this._getControls(context) : undefined,
      details: this._details,
      text: ViewItemClassifier.isMedia(this._item)
        ? this._item.getDescription() ?? undefined
        : undefined,
    };
  }

  private _getControls(context: NotificationControlsContext): NotificationControl[] {
    const controls: NotificationControl[] = [];
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
        actions: {
          tap_action: createInternalCallbackAction(async (api) => {
            const success = await toggleReviewed(
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
        severity: isFavorite ? 'medium' : undefined,
        actions: {
          tap_action: createInternalCallbackAction(async (api) => {
            const success = await toggleFavorite(item, context.viewItemManager);
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
