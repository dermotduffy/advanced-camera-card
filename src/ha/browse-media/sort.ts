import { orderBy } from 'lodash-es';
import { BrowseMediaMetadata, RichBrowseMedia } from './types';

// Unlike sorting of view items (see card-controller/view/sort.ts), for browse
// media we often need to sort by most recent first to apply an item count
// cutoff from the most recent (this differs from how items may be sorted prior
// to presentation).
//
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2078

export const sortMostRecentFirst = (
  media: RichBrowseMedia<BrowseMediaMetadata>[],
): RichBrowseMedia<BrowseMediaMetadata>[] => {
  return orderBy(media, (media) => media._metadata?.startDate, 'desc');
};
