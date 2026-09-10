import { format } from 'date-fns';

import type { CameraManager } from '../../camera-manager/manager';
import { localize } from '../../localize/localize';
import type { Severity } from '../../severity';
import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import {
  getMediaCameraTitle,
  getMediaDuration,
  getMediaLabel,
  getMediaTags,
  getMediaWhere,
} from './format';

// A single piece of data about a media item.
export interface MediaDetail {
  text: string;
  icon?: string;
  tooltip?: string;
  severity?: Severity;
}

export interface MediaDetailOptions {
  cameraManager?: CameraManager;
  item?: ViewItem;
}

/**
 * @param options The item, and the camera manager for media that names only its
 * camera.
 * @returns The item heading or `null` if there is none.
 */
export const getMediaHeading = (options: MediaDetailOptions): MediaDetail | null => {
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

const toDetails = (text: string | null, icon: string, tooltip: string): MediaDetail[] =>
  text ? [{ text, icon, tooltip }] : [];

/**
 * @param options The item, and the camera manager for the camera title.
 * @returns Everything known about the item beyond its heading, in display
 * order.
 */
export const getMediaDetails = (options: MediaDetailOptions): MediaDetail[] => {
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

export const getMediaSeekDetail = (seek?: Date): MediaDetail | null =>
  seek
    ? {
        text: format(seek, 'HH:mm:ss'),
        icon: 'mdi:clock-fast',
        tooltip: localize('thumbnail.seek'),
      }
    : null;
