import { rangesOverlap } from '../../utils/date/range';
import type { BrowseMediaMetadata, RichBrowseMedia } from './types';

/**
 * A utility method to determine if a browse media object matches against a
 * start and end date.
 * @param media The browse media object (with rich metadata).
 * @param start The optional start date.
 * @param end The optional end date.
 * @returns `true` if the media falls within the provided dates.
 */

export const isMediaWithinDates = (
  media: RichBrowseMedia<BrowseMediaMetadata>,
  start?: Date,
  end?: Date,
): boolean => {
  // If there's no start time, nothing matches.
  if (!media._metadata?.startTime) {
    return false;
  }

  if (start && end) {
    // Determine if:
    // - The media starts within the query timeframe.
    // - The media ends within the query timeframe.
    // - The media entirely encompasses the query timeframe.
    return rangesOverlap(
      {
        start: media._metadata.startTime,

        // Media without an end time is a single point in time.
        end: media._metadata.endTime ?? media._metadata.startTime,
      },
      {
        start: start,
        end: end,
      },
    );
  }

  if (!start && end) {
    return media._metadata.startTime <= end;
  }
  if (start && !end) {
    return media._metadata.startTime >= start;
  }

  // If no date is specified at all, everything matches.
  return true;
};
