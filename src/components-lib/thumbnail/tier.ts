import { THUMBNAIL_SIZE_DEFAULT } from '../../config/schema/common/controls/thumbnails';

export type ThumbnailTier = 'compact' | 'standard' | 'comfortable' | 'poster';

const TIER_SIZE_MIN: Record<Exclude<ThumbnailTier, 'compact'>, number> = {
  standard: 100,
  comfortable: 175,
  poster: 250,
};

export const getThumbnailTier = (
  size: number = THUMBNAIL_SIZE_DEFAULT,
): ThumbnailTier =>
  size >= TIER_SIZE_MIN.poster
    ? 'poster'
    : size >= TIER_SIZE_MIN.comfortable
      ? 'comfortable'
      : size >= TIER_SIZE_MIN.standard
        ? 'standard'
        : 'compact';
