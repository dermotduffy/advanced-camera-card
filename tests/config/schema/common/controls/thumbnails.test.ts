import { describe, expect, it } from 'vitest';

import { thumbnailsControlBaseSchema } from '../../../../../src/config/schema/common/controls/thumbnails';

describe('thumbnailsControlBaseSchema', () => {
  it('should default to a square aspect ratio', () => {
    expect(thumbnailsControlBaseSchema.parse({}).aspect_ratio).toEqual([1, 1]);
  });

  it.each([
    ['16:9', [16, 9]],
    ['4 / 3', [4, 3]],
    [
      [9, 16],
      [9, 16],
    ],
  ])('should parse aspect ratio %s', (input, expected) => {
    expect(
      thumbnailsControlBaseSchema.parse({ aspect_ratio: input }).aspect_ratio,
    ).toEqual(expected);
  });

  it('should reject an invalid aspect ratio', () => {
    expect(thumbnailsControlBaseSchema.safeParse({ aspect_ratio: 'wide' }).success).toBe(
      false,
    );
  });
});
