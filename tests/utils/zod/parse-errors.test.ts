import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { getParseError, getParseErrorPaths } from '../../../src/utils/zod/parse-errors';

describe('getParseErrorPaths', () => {
  it('should get error paths', () => {
    const result = z
      .object({ a: z.string(), b: z.number() })
      .safeParse({ a: 1, b: 'a' });
    if (result.success) {
      return;
    }
    expect(getParseErrorPaths(result.error)).toEqual(new Set(['a', 'b']));
  });

  it('should get nested error paths', () => {
    const result = z
      .object({ a: z.object({ b: z.string() }) })
      .safeParse({ a: { b: 1 } });
    if (result.success) {
      return;
    }
    expect(getParseErrorPaths(result.error)).toEqual(new Set(['a.b']));
  });

  it('should get array error paths', () => {
    const result = z.array(z.string()).safeParse([1, 'a', 2]);
    if (result.success) {
      return;
    }
    expect(getParseErrorPaths(result.error)).toEqual(new Set(['[0]', '[2]']));
  });

  it('should get complex nested error paths', () => {
    const result = z
      .object({ a: z.array(z.object({ b: z.string() })) })
      .safeParse({ a: [{ b: 1 }, { b: 'a' }, { b: 2 }] });
    if (result.success) {
      return;
    }
    expect(getParseErrorPaths(result.error)).toEqual(new Set(['a[0].b', 'a[2].b']));
  });
});

describe('getParseError', () => {
  it('should get simple error paths', () => {
    const result = z.object({ required: z.string() }).safeParse({});
    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(getParseError(result.error)).toBe('[\n "required"\n]');
  });

  it('should get union error paths', () => {
    const type_one = z.object({ type: z.string(), data: z.string() });
    const type_two = z.object({ type: z.literal('two'), data: z.string() });

    const schema = z.object({
      array: type_one.or(type_two).array(),
    });

    const result = schema.safeParse({ array: [{}] });
    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(getParseError(result.error)).toBe(
      '[\n "array[0].type",\n "array[0].data"\n]',
    );
  });

  it('should get root union error paths', () => {
    const schema = z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]);

    const result = schema.safeParse({});
    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }

    expect(getParseError(result.error)).toBe('[\n "a",\n "b"\n]');
  });

  it('should get no paths for empty error', () => {
    expect(getParseError(new ZodError([]))).toBeNull();
  });
});
