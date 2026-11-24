import { describe, expect, it } from 'vitest';

import {
  getThumbnailTier,
  THUMBNAIL_TIER_DEFAULT,
} from '../../../src/components-lib/thumbnail/tier';

describe('getThumbnailTier', () => {
  it.each([
    ['compact', 75],
    ['compact', 99],
    ['standard', 100],
    ['standard', 174],
    ['comfortable', 175],
    ['comfortable', 249],
    ['poster', 250],
    ['poster', 300],
  ])('should use the %s tier at size %s', (tier, size) => {
    expect(getThumbnailTier(size)).toBe(tier);
  });
});

describe('THUMBNAIL_TIER_DEFAULT', () => {
  it('should be the tier of the default thumbnail size', () => {
    expect(THUMBNAIL_TIER_DEFAULT).toBe('standard');
  });
});
