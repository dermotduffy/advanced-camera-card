import type { CameraManager } from '../../camera-manager/manager';
import { localize } from '../../localize/localize';
import type { Severity } from '../../severity';
import { getDurationString, isTruthy, prettifyTitle } from '../../utils/basic';
import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';

const JOINER = ' · ';

export const joinValues = (...values: (string | null | undefined)[]): string | null =>
  values.filter(isTruthy).join(JOINER) || null;

export const getMediaCameraTitle = (
  cameraManager?: CameraManager,
  item?: ViewItem,
): string | null => {
  const cameraID = ViewItemClassifier.isMedia(item) ? item.getCameraID() : null;
  return cameraID ? cameraManager?.getCameraMetadata(cameraID)?.title ?? null : null;
};

export const isMediaReviewed = (item?: ViewItem): boolean | null =>
  ViewItemClassifier.isReview(item) ? item.isReviewed() : null;

export const getMediaSeverity = (item?: ViewItem): Severity | null =>
  ViewItemClassifier.isReview(item) ? item.getSeverity() : null;

export const getMediaTags = (item?: ViewItem): string | null =>
  (ViewItemClassifier.isEvent(item)
    ? prettifyTitle(item.getTags()?.join(', '))
    : undefined) ?? null;

export const getMediaWhere = (item?: ViewItem): string | null =>
  (ViewItemClassifier.isMedia(item)
    ? prettifyTitle(item.getWhere()?.join(', '))
    : undefined) ?? null;

/**
 * @param item The item.
 * @returns How long the media lasted: `41s`, `In progress...`, or both.
 */
export const getMediaDuration = (item?: ViewItem): string | null => {
  const startTime = ViewItemClassifier.isMedia(item) ? item.getStartTime() : null;
  const endTime = ViewItemClassifier.isMedia(item) ? item.getEndTime() : null;

  const duration = startTime && endTime ? getDurationString(startTime, endTime) : null;
  const inProgress =
    ViewItemClassifier.isMedia(item) && item.inProgress()
      ? localize('common.in_progress')
      : null;

  return duration && inProgress ? `${duration} ${inProgress}` : duration ?? inProgress;
};

/**
 * The fewest words that tell this media apart from its neighbours in a list.
 * Shorter than `ViewItem.getTitle()`, which describes the media in full for a
 * filename or a screen reader.
 * @param cameraManager The camera manager, for media that names only its camera.
 * @param item The item.
 * @returns The label, or `null` if the media says nothing about itself.
 */
export const getMediaLabel = (
  cameraManager?: CameraManager,
  item?: ViewItem,
): string | null => {
  if (ViewItemClassifier.isEvent(item)) {
    const what = prettifyTitle(item.getWhat()?.join(', '));
    const rawScore = item.getScore();
    const score = rawScore ? `${Math.round(rawScore * 100)}%` : null;

    if (what) {
      return `${what}${score ? ` ${score}` : ''}`;
    }
  }

  // Only the engine knows what a review is called.
  if (ViewItemClassifier.isReview(item)) {
    const title = item.getTitle();
    if (title) {
      return title;
    }
  }

  // Nothing shorter identifies the media, so fall back to its full name.
  return getMediaCameraTitle(cameraManager, item) ?? item?.getTitle() ?? null;
};
