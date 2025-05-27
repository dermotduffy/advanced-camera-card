import { rangesOverlap } from '../../camera-manager/range';
import { BrowseMediaMetadata, RichBrowseMedia } from './types';

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
  // If there's no metadata, nothing matches.
  if (!media._metadata?.startDate || !media._metadata?.endDate) {
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
        end: media._metadata.endDate,
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
