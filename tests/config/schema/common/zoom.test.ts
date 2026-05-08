import { describe, expect, it } from 'vitest';
import {
  ZOOM_MAX,
  ZOOM_MIN,
  zoomSchema,
} from '../../../../src/config/schema/common/zoom';

describe('zoomSchema', () => {
  it('should accept the boundary values', () => {
    expect(zoomSchema.parse(ZOOM_MIN)).toBe(ZOOM_MIN);
    expect(zoomSchema.parse(ZOOM_MAX)).toBe(ZOOM_MAX);
  });

  it('should accept values within the bounds', () => {
    expect(zoomSchema.parse(2.5)).toBe(2.5);
  });

  it('should reject values below the minimum', () => {
    expect(zoomSchema.safeParse(ZOOM_MIN - 0.01).success).toBe(false);
  });

  it('should reject values above the maximum', () => {
    expect(zoomSchema.safeParse(ZOOM_MAX + 0.01).success).toBe(false);
  });

  it('should reject non-numeric input', () => {
    expect(zoomSchema.safeParse('5').success).toBe(false);
  });
});
