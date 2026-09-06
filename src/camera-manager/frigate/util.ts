import { fromUnixTime, subSeconds } from 'date-fns';

import type { CameraConfig } from '../../config/schema/cameras';
import type { Severity } from '../../severity';
import { formatDateAndTime, prettifyTitle } from '../../utils/basic';
import { getDayHourInTimeZone, startOfHourInTimeZone } from '../../utils/timezone';
import type {
  FrigateEvent,
  FrigateRecording,
  FrigateReview,
  FrigateReviewSeverity,
} from './types';

// A review starts at the moment of detection, so playback without padding opens
// with the subject already in frame. Five seconds matches the padding the
// Frigate integration applies to event clips:
// https://github.com/blakeblackshear/frigate-hass-integration/blob/v5.15.4/custom_components/frigate/const.py#L71
const FRIGATE_REVIEW_PADDING_SECONDS = 5;

/**
 * Given an event generate a title.
 * @param event
 */
export const getEventTitle = (event: FrigateEvent): string => {
  const durationSeconds = Math.round(
    event.end_time
      ? event.end_time - event.start_time
      : Date.now() / 1000 - event.start_time,
  );
  const score = event.top_score !== null ? ` ${Math.round(event.top_score * 100)}%` : '';

  return `${formatDateAndTime(
    new Date(event.start_time * 1000),
  )} [${durationSeconds}s, ${prettifyTitle(event.label)}${score}]`;
};

export const getRecordingTitle = (
  cameraTitle: string,
  recording: FrigateRecording,
): string => {
  return `${cameraTitle} ${formatDateAndTime(recording.startTime)}`;
};

/**
 * Get a thumbnail URL for an event.
 * @param clientId The Frigate client id.
 * @param event The event.
 * @returns A string URL.
 */
export const getEventThumbnailURL = (clientId: string, event: FrigateEvent): string => {
  return `/api/frigate/${clientId}/thumbnail/${event.id}`;
};

/**
 * Get a media content ID for an event.
 * @param clientId The Frigate client id.
 * @param cameraName The Frigate camera name.
 * @param event The Frigate event.
 * @param mediaType The media type required.
 * @returns A string media content id.
 */
export const getEventMediaContentID = (
  clientId: string,
  cameraName: string,
  event: FrigateEvent,
  mediaType: 'clips' | 'snapshots',
): string => {
  return `media-source://frigate/${clientId}/event/${mediaType}/${cameraName}/${event.id}`;
};

/**
 * Build a recording media content ID from a start time.
 * @param timeZone The timezone the Frigate integration resolves the day and
 * hour in.
 */
const buildRecordingMediaContentID = (
  clientId: string,
  cameraName: string,
  startTime: Date,
  timeZone: string,
): string => {
  const dayHour = getDayHourInTimeZone(startTime, timeZone);
  return [
    'media-source://frigate',
    clientId,
    'recordings',
    cameraName,
    dayHour.day,
    String(dayHour.hour).padStart(2, '0'),
  ].join('/');
};

/**
 * Generate a recording media content ID.
 */
export const getRecordingMediaContentID = (
  clientId: string,
  cameraName: string,
  recording: FrigateRecording,
  timeZone: string,
): string =>
  buildRecordingMediaContentID(clientId, cameraName, recording.startTime, timeZone);

/**
 * Get a recording ID for internal de-duping.
 */
export const getRecordingID = (
  cameraConfig: CameraConfig,
  recording: FrigateRecording,
): string => {
  // ID name is derived from the real camera name (not CameraID) since the
  // recordings for the same camera across multiple zones will be the same and
  // can be dedup'd from this id.
  return `${cameraConfig.frigate?.client_id ?? ''}/${
    cameraConfig.frigate.camera_name ?? ''
  }/${recording.startTime.getTime()}/${recording.endTime.getTime()}`;
};

/**
 * Given a review generate a title.
 * @param review The Frigate review item.
 */
export const getReviewTitle = (review: FrigateReview): string => {
  // Frigate flags Frigate+ verified detections by suffixing the object label
  // with `-verified`. The user-meaningful identification (e.g. species) lives
  // in `sub_labels` instead, so strip the suffix and surface sub_labels as a
  // tag separated by ': ' (matching event title formatting).
  const objects = review.data.objects?.length
    ? review.data.objects
        .map((o) => prettifyTitle(o.replace(/-verified$/, '')))
        .join(', ')
    : '';
  const subLabels = review.data.sub_labels?.length
    ? review.data.sub_labels.map((s) => prettifyTitle(s)).join(', ')
    : '';

  if (objects && subLabels) {
    return `${objects}: ${subLabels}`;
  }
  if (objects || subLabels) {
    return objects || subLabels;
  }

  const durationSeconds = Math.round(
    review.end_time
      ? review.end_time - review.start_time
      : Date.now() / 1000 - review.start_time,
  );

  return `${formatDateAndTime(
    new Date(review.start_time * 1000),
  )} [${durationSeconds}s]`;
};

/**
 * Generate a review media content ID.
 */
export const getReviewMediaContentID = (
  clientId: string,
  cameraName: string,
  review: FrigateReview,
  timeZone: string,
): string =>
  buildRecordingMediaContentID(
    clientId,
    cameraName,
    new Date(review.start_time * 1000),
    timeZone,
  );

/**
 * Get the time playback of a review should start at.
 * @param timeZone The timezone the Frigate integration resolves the day and
 * hour in.
 */
export const getReviewPlaybackStartTime = (
  review: FrigateReview,
  timeZone: string,
): Date => {
  const startTime = fromUnixTime(review.start_time);
  const paddedStartTime = subSeconds(startTime, FRIGATE_REVIEW_PADDING_SECONDS);
  const recordingStartTime = startOfHourInTimeZone(startTime, timeZone);

  // Frigate stores recordings in one-hour files, so ensure the padding never
  // reaches back past the start of the hour that contains the review.
  return paddedStartTime < recordingStartTime ? recordingStartTime : paddedStartTime;
};

/**
 * Get a thumbnail URL for a review.
 */
export const getReviewThumbnailURL = (
  clientId: string,
  review: FrigateReview,
): string | null => {
  if (!review.thumb_path) {
    return null;
  }
  const path = review.thumb_path.replace('/media/frigate/', '');
  return `/api/frigate/${clientId}/${path}`;
};

/**
 * Get generic review severity.
 */
export const getReviewSeverity = (severity: FrigateReviewSeverity): Severity => {
  // Frigate severities: 'alert' -> 'high', 'detection' -> 'medium'.
  if (severity === 'alert') {
    return 'high';
  }
  return 'medium';
};
