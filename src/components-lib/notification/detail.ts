import { format } from 'date-fns';

import type { CameraManager } from '../../camera-manager/manager';
import type { NotificationDetail } from '../../config/schema/actions/types';
import { localize } from '../../localize/localize';
import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaTags,
  getMediaWhere,
} from '../media/format';

export interface NotificationDetailOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
}

/**
 * @param options The item, and the camera manager for media that names only its
 * camera.
 * @returns The item heading or `null` if there is none.
 */
export const getMediaHeading = (
  options: NotificationDetailOptions,
): NotificationDetail | null => {
  const label = getMediaLabel(options.cameraManager, options.item);
  if (!label) {
    return null;
  }

  if (ViewItemClassifier.isReview(options.item)) {
    const severity = options.item.getSeverity();
    return {
      text: label,
      severity: severity ?? undefined,
      tooltip:
        localize('common.severity') + ': ' + localize('common.severities.' + severity),
      icon: 'mdi:circle-medium',
    };
  }

  return { text: label };
};

const toDetails = (
  text: string | null,
  icon: string,
  tooltip: string,
): NotificationDetail[] => (text ? [{ text, icon, tooltip }] : []);

/**
 * @param options The item, and the camera manager for the camera title.
 * @returns Everything known about the item beyond its heading, in display
 * order.
 */
export const getNotificationDetails = (
  options: NotificationDetailOptions,
): NotificationDetail[] => {
  const startTime = ViewItemClassifier.isMedia(options.item)
    ? options.item.getStartTime()
    : null;

  return [
    ...toDetails(
      startTime ? format(startTime, 'yyyy-MM-dd HH:mm:ss') : null,
      'mdi:calendar-clock-outline',
      localize('thumbnail.start'),
    ),
    ...toDetails(
      getMediaDuration(options.item),
      'mdi:clock-outline',
      localize('thumbnail.duration'),
    ),
    ...toDetails(
      getMediaCameraTitle(options.cameraManager, options.item),
      'mdi:cctv',
      localize('thumbnail.camera'),
    ),
    ...toDetails(
      getMediaWhere(options.item),
      'mdi:map-marker-outline',
      localize('thumbnail.where'),
    ),
    ...toDetails(getMediaTags(options.item), 'mdi:tag', localize('thumbnail.tag')),
  ];
};

export const getMediaSeekDetail = (seek?: Date): NotificationDetail | null =>
  seek
    ? {
        text: format(seek, 'HH:mm:ss'),
        icon: 'mdi:clock-fast',
        tooltip: localize('thumbnail.seek'),
      }
    : null;
