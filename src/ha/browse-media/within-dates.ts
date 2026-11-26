import { rangesOverlap } from '../../camera-manager/range';
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
  // If there's no start date, nothing matches.
  if (!media._metadata?.startDate) {
    return false;
  }

  if (start && end) {
    // Determine if:
    // - The media starts within the query timeframe.
    // - The media ends within the query timeframe.
    // - The media entirely encompasses the query timeframe.
    return rangesOverlap(
      {
        start: media._metadata.startDate,

        // Media without an end date is a single point in time.
        end: media._metadata.endDate ?? media._metadata.startDate,
      },
      {
        start: start,
        end: end,
      },
    );
  }

  if (!start && end) {
    return media._metadata.startDate <= end;
  }
  if (start && !end) {
    return media._metadata.startDate >= start;
  }

  // If no date is specified at all, everything matches.
  return true;
};
