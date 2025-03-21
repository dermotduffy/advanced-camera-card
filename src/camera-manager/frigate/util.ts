import { toZonedTime } from 'date-fns-tz';
import { CameraConfig } from '../../config/schema/cameras';
import { ClipsOrSnapshots } from '../../types';
import { formatDateAndTime, prettifyTitle } from '../../utils/basic';
import { FrigateEvent, FrigateRecording } from './types';

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
 * Generate a recording identifier.
 * @param clientId The Frigate client id.
 * @param cameraName The Frigate camera name.
 * @param recording The Frigate recording.
 * @returns A recording identifier.
 */
export const getRecordingMediaContentID = (
  clientId: string,
  cameraName: string,
  recording: FrigateRecording,
): string => {
  return [
    'media-source://frigate',
    clientId,
    'recordings',
    cameraName,
    `${recording.startTime.getFullYear()}-${String(
      recording.startTime.getMonth() + 1,
    ).padStart(2, '0')}-${String(
      String(recording.startTime.getDate()).padStart(2, '0'),
    )}`,
    String(recording.startTime.getHours()).padStart(2, '0'),
  ].join('/');
};

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
