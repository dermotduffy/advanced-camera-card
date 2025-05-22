import { orderBy } from 'lodash-es';
import { BrowseMediaMetadata, RichBrowseMedia } from './types';

export const sortMediaByStartDate = (
  media: RichBrowseMedia<BrowseMediaMetadata>[],
): RichBrowseMedia<BrowseMediaMetadata>[] => {
  return orderBy(media, (media) => media._metadata?.startDate, 'desc');
};
