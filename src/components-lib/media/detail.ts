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

/**
 * @param cameraManager The camera manager, for media that names only its camera.
 * @param item The item.
 * @returns The item heading or `null` if there is none.
 */
export const getMediaHeading = (
  cameraManager?: CameraManager,
  item?: ViewItem,
): MediaDetail | null => {
  const label = getMediaLabel(cameraManager, item);
  if (!label) {
    return null;
  }

  if (ViewItemClassifier.isReview(item)) {
    const severity = item.getSeverity();
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
 * @param cameraManager The camera manager, for the camera title.
 * @param item The item.
 * @param seek The time under the cursor while the user drags the timeline.
 * @returns Everything known about the item beyond its heading, in display
 * order.
 */
export const getMediaDetails = (
  cameraManager?: CameraManager,
  item?: ViewItem,
  seek?: Date,
): MediaDetail[] => {
  const startTime = ViewItemClassifier.isMedia(item) ? item.getStartTime() : null;

  return [
    ...toDetails(
      startTime ? format(startTime, 'yyyy-MM-dd HH:mm:ss') : null,
      'mdi:calendar-clock-outline',
      localize('thumbnail.start'),
    ),
    ...toDetails(
      getMediaDuration(item),
      'mdi:clock-outline',
      localize('thumbnail.duration'),
    ),
    ...toDetails(
      getMediaCameraTitle(cameraManager, item),
      'mdi:cctv',
      localize('thumbnail.camera'),
    ),
    ...toDetails(
      getMediaWhere(item),
      'mdi:map-marker-outline',
      localize('thumbnail.where'),
    ),
    ...toDetails(getMediaTags(item), 'mdi:tag', localize('thumbnail.tag')),
    ...toDetails(
      seek ? format(seek, 'HH:mm:ss') : null,
      'mdi:clock-fast',
      localize('thumbnail.seek'),
    ),
  ];
};
