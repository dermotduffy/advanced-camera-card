import { describe, expect, it } from 'vitest';
import { aspectRatioSchema } from '../../../../src/config/schema/common/aspect-ratio';

describe('aspectRatioSchema', () => {
  it('should parse a [w, h] tuple', () => {
    expect(aspectRatioSchema.parse([16, 9])).toEqual([16, 9]);
  });

  it.each([
    ['16:9', [16, 9]],
    ['16/9', [16, 9]],
    [' 4 : 3 ', [4, 3]],
    ['1.5:1', [1.5, 1]],
  ])('should parse string %s into a numeric tuple', (input, expected) => {
    expect(aspectRatioSchema.parse(input)).toEqual(expected);
  });

  it('should reject a string with an unsupported separator', () => {
    expect(aspectRatioSchema.safeParse('16-9').success).toBe(false);
  });

  it('should reject a non-numeric string', () => {
    expect(aspectRatioSchema.safeParse('wide').success).toBe(false);
  });

  it('should reject an array of the wrong length', () => {
    expect(aspectRatioSchema.safeParse([16]).success).toBe(false);
    expect(aspectRatioSchema.safeParse([16, 9, 1]).success).toBe(false);
  });

  it('should reject an array of non-numbers', () => {
    expect(aspectRatioSchema.safeParse(['16', '9']).success).toBe(false);
  });
});
