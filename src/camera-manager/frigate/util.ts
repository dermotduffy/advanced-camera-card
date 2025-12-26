import { toZonedTime } from 'date-fns-tz';
import { CameraConfig } from '../../config/schema/cameras';
import { ClipsOrSnapshots, Severity } from '../../types';
import { formatDateAndTime, prettifyTitle } from '../../utils/basic';
import {
  FrigateEvent,
  FrigateRecording,
  FrigateReview,
  FrigateReviewSeverity,
} from './types';

/**
 * Given an event generate a title.
 * @param event
 */
export const getEventTitle = (event: FrigateEvent): string => {
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const durationSeconds = Math.round(
    event.end_time
      ? event.end_time - event.start_time
      : Date.now() / 1000 - event.start_time,
  );
  const score = event.top_score !== null ? ` ${Math.round(event.top_score * 100)}%` : '';

  return `${formatDateAndTime(
    toZonedTime(event.start_time * 1000, localTimezone),
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
  mediaType: ClipsOrSnapshots,
): string => {
  return `media-source://frigate/${clientId}/event/${mediaType}/${cameraName}/${event.id}`;
};

/**
 * Build a recording media content ID from a start time.
 */
const buildRecordingMediaContentID = (
  clientId: string,
  cameraName: string,
  startTime: Date,
): string =>
  [
    'media-source://frigate',
    clientId,
    'recordings',
    cameraName,
    `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`,
    String(startTime.getHours()).padStart(2, '0'),
  ].join('/');

/**
 * Generate a recording media content ID.
 */
export const getRecordingMediaContentID = (
  clientId: string,
  cameraName: string,
  recording: FrigateRecording,
): string => buildRecordingMediaContentID(clientId, cameraName, recording.startTime);

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
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const durationSeconds = Math.round(
    review.end_time
      ? review.end_time - review.start_time
      : Date.now() / 1000 - review.start_time,
  );
  const objects = review.data.objects?.length
    ? `, ${review.data.objects.map((o) => prettifyTitle(o)).join(', ')}`
    : '';

  return `${formatDateAndTime(
    toZonedTime(review.start_time * 1000, localTimezone),
  )} [${durationSeconds}s${objects}]`;
};

/**
 * Generate a review media content ID.
 */
export const getReviewMediaContentID = (
  clientId: string,
  cameraName: string,
  review: FrigateReview,
): string =>
  buildRecordingMediaContentID(clientId, cameraName, new Date(review.start_time * 1000));

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
  if (severity === 'alert') {
    return 'high';
  }
  if (severity === 'detection') {
    return 'medium';
  }
  return 'low';
};
