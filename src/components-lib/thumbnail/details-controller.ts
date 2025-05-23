import { format } from 'date-fns';
import { CameraManager } from '../../camera-manager/manager';
import { CameraManagerCameraMetadata } from '../../camera-manager/types';
import { localize } from '../../localize/localize';
import { Icon } from '../../types';
import { getDurationString, prettifyTitle } from '../../utils/basic';
import { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';

interface Detail {
  icon?: Icon;
  hint?: string;
  title: string;
}

export class ThumbnailDetailsController {
  private _details: Detail[] = [];
  private _heading: string | null = null;

  public calculate(
    cameraManager?: CameraManager | null,
    item?: ViewItem,
    seek?: Date,
  ): void {
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

      this._heading = whatWithTags ? `${whatWithTags}${score ? ` ${score}` : ''}` : null;
      return;
    }

    if (cameraMetadata?.title) {
      this._heading = cameraMetadata.title;
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

    // To avoid duplication, if the event already has a structured 'what' and a
    // starttime, the title is omitted from the details.
    const includeTitle =
      !ViewItemClassifier.isEvent(item) || !item?.getWhat()?.length || !startTime;
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

  public getHeading(): string | null {
    return this._heading;
  }

  public getDetails(): Detail[] {
    return this._details;
  }
}
