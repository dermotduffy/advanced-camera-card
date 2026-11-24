import { differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

/**
 * Convenience function to return a string representing the difference in hours,
 * minutes and seconds between two dates. Heavily inspired by, and returning the
 * same format as, the Frigate UI:
 * https://github.com/blakeblackshear/frigate/blob/master/web/src/components/RecordingPlaylist.jsx#L97
 * @param start The start date.
 * @param end The end date.
 * @returns A duration string.
 */
export function getDurationString(start: Date, end: Date): string {
  const hours = differenceInHours(end, start);
  const minutes = differenceInMinutes(end, start) - hours * 60;
  const seconds = differenceInSeconds(end, start) - hours * 60 * 60 - minutes * 60;
  let duration = '';

  if (hours) {
    duration += `${hours}h `;
  }
  if (minutes) {
    duration += `${minutes}m `;
  }
  duration += `${seconds}s`;
  return duration;
}
