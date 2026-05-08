import { describe, expect, it } from 'vitest';
import {
  imageBaseConfigDefault,
  imageBaseConfigSchema,
} from '../../../../src/config/schema/common/image';

describe('imageBaseConfigSchema', () => {
  it('should fill in defaults from an empty object', () => {
    expect(imageBaseConfigSchema.parse({})).toEqual(imageBaseConfigDefault);
  });

  it.each(['auto', 'camera', 'default', 'entity', 'screensaver', 'url'])(
    'should accept mode %s',
    (mode) => {
      expect(imageBaseConfigSchema.parse({ mode }).mode).toBe(mode);
    },
  );

  it('should reject an unrecognised mode', () => {
    expect(imageBaseConfigSchema.safeParse({ mode: 'panorama' }).success).toBe(false);
  });

  it('should accept refresh_seconds = "auto"', () => {
    expect(imageBaseConfigSchema.parse({ refresh_seconds: 'auto' }).refresh_seconds)
      .toBe('auto');
  });

  it('should accept a non-negative refresh_seconds', () => {
    expect(imageBaseConfigSchema.parse({ refresh_seconds: 0 }).refresh_seconds).toBe(0);
    expect(imageBaseConfigSchema.parse({ refresh_seconds: 5 }).refresh_seconds).toBe(5);
  });

  it('should reject a negative refresh_seconds', () => {
    expect(imageBaseConfigSchema.safeParse({ refresh_seconds: -1 }).success).toBe(
      false,
    );
  });

  it('should reject a non-string url', () => {
    expect(imageBaseConfigSchema.safeParse({ url: 123 }).success).toBe(false);
  });
});
