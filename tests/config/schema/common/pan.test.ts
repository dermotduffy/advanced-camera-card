import { describe, expect, it } from 'vitest';
import { panSchema } from '../../../../src/config/schema/common/pan';

describe('panSchema', () => {
  it('should parse coordinates within bounds', () => {
    expect(panSchema.parse({ x: 0, y: 100 })).toEqual({ x: 0, y: 100 });
    expect(panSchema.parse({ x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });

  it('should accept partial coordinates', () => {
    expect(panSchema.parse({ x: 25 })).toEqual({ x: 25 });
    expect(panSchema.parse({})).toEqual({});
  });

  it('should reject coordinates below the minimum', () => {
    expect(panSchema.safeParse({ x: -1 }).success).toBe(false);
    expect(panSchema.safeParse({ y: -0.01 }).success).toBe(false);
  });

  it('should reject coordinates above the maximum', () => {
    expect(panSchema.safeParse({ x: 101 }).success).toBe(false);
    expect(panSchema.safeParse({ y: 100.01 }).success).toBe(false);
  });
});
