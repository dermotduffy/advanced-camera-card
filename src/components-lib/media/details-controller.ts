import { format } from 'date-fns';
import { CameraManager } from '../../camera-manager/manager';
import { CameraManagerCameraMetadata } from '../../camera-manager/types';
import { ViewItemManager } from '../../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../../card-controller/view/types';
import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { MetadataField, OverlayMessage, OverlayMessageControl } from '../../types';
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

export interface OverlayControlsContext {
  hass?: HomeAssistant;
  viewItemManager?: ViewItemManager;
  viewManagerEpoch?: ViewManagerEpoch;
  capabilities?: ViewItemCapabilities | null;
}

export class MediaDetailsController {
  private _details: MetadataField[] = [];
  private _heading: MetadataField | null = null;
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
        ? { title: `${whatWithTags}${score ? ` ${score}` : ''}` }
        : null;
      return;
    }

    if (ViewItemClassifier.isReview(item)) {
      const title = item.getTitle();
      const severity = item.getSeverity();

      this._heading = title
        ? {
            title: title,
            emphasis: severity ?? undefined,
            hint:
              localize('common.severity') +
              ': ' +
              localize('common.severities.' + severity),
            icon: { icon: 'mdi:circle-medium' },
          }
        : null;
      return;
    }

    if (cameraMetadata?.title) {
      this._heading = {
        title: cameraMetadata.title,
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
              hint: localize('thumbnail.start'),
              icon: { icon: 'mdi:calendar-clock-outline' },
              title: format(startTime, 'yyyy-MM-dd HH:mm:ss'),
            },
          ]
        : []),
      ...(duration || inProgress
        ? [
            {
              hint: localize('thumbnail.duration'),
              icon: { icon: 'mdi:clock-outline' },
              title: `${duration ?? ''}${duration && inProgress ? ' ' : ''}${inProgress ?? ''}`,
            },
          ]
        : []),
      ...(cameraMetadata?.title
        ? [
            {
              hint: localize('thumbnail.camera'),
              title: cameraMetadata.title,
              icon: { icon: 'mdi:cctv' },
            },
          ]
        : []),
      ...(where
        ? [
            {
              hint: localize('thumbnail.where'),
              title: where,
              icon: { icon: 'mdi:map-marker-outline' },
            },
          ]
        : []),
      ...(tags
        ? [
            {
              hint: localize('thumbnail.tag'),
              title: tags,
              icon: { icon: 'mdi:tag' },
            },
          ]
        : []),
      ...(seekString
        ? [
            {
              hint: localize('thumbnail.seek'),
              title: seekString,
              icon: { icon: 'mdi:clock-fast' },
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
              title: itemTitle,
              ...(details.length > 0 && {
                icon: { icon: 'mdi:rename' },
                hint: localize('thumbnail.title'),
              }),
            },
          ]
        : []),
      ...details,
    ];
  }

  public getHeading(): MetadataField | null {
    return this._heading;
  }

  public getDetails(): MetadataField[] {
    return this._details;
  }

  /**
   * Get an overlay message for the item.
   * @param context Optional context to include controls.
   * @returns An OverlayMessage.
   */
  public getMessage(context?: OverlayControlsContext): OverlayMessage {
    return {
      heading: this._heading ?? undefined,
      controls: context ? this._getControls(context) : undefined,
      details: this._details,
      text: ViewItemClassifier.isMedia(this._item)
        ? this._item.getDescription() ?? undefined
        : undefined,
    };
  }

  protected _getControls(context: OverlayControlsContext): OverlayMessageControl[] {
    const controls: OverlayMessageControl[] = [];
    const item = this._item;

    if (!item) {
      return controls;
    }

    if (ViewItemClassifier.isReview(item)) {
      const isReviewed = item.isReviewed();
      controls.push({
        title: isReviewed
          ? localize('common.set_reviews.unreviewed')
          : localize('common.set_reviews.reviewed'),
        icon: { icon: isReviewed ? 'mdi:check-circle' : 'mdi:check-circle-outline' },
        callback: async () => {
          const success = await toggleReviewed(item, context);
          return success ? this.getMessage(context) : null;
        },
      });
    }

    if (context.capabilities?.canFavorite && ViewItemClassifier.isMedia(item)) {
      const isFavorite = item.isFavorite();
      controls.push({
        title: localize('thumbnail.retain_indefinitely'),
        icon: { icon: isFavorite ? 'mdi:star' : 'mdi:star-outline' },
        emphasis: isFavorite ? 'medium' : undefined,
        callback: async () => {
          const success = await toggleFavorite(item, context);
          return success ? this.getMessage(context) : null;
        },
      });
    }

    if (context.capabilities?.canDownload && item.getID()) {
      controls.push({
        title: localize('thumbnail.download'),
        icon: { icon: 'mdi:download' },
        callback: async () => {
          await downloadMedia(item, context);

          // Close overlay message after download.
          return null;
        },
      });
    }

    if (ViewItemClassifier.supportsTimeline(item) && context.viewManagerEpoch) {
      controls.push({
        title: localize('thumbnail.timeline'),
        icon: { icon: 'mdi:target' },
        callback: () => {
          navigateToTimeline(item, context);

          // Close overlay after timeline navigation
          return null;
        },
      });
    }

    return controls;
  }
}
