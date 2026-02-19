import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { deepRemoveDefaults } from '../../../src/utils/zod/deep-remove-defaults';

describe('deepNoDefaults', () => {
  describe('object field behavior', () => {
    it('strips defaulted object fields', () => {
      const schema = z.object({
        string: z.string().default('foo'),
      });
      const result = deepRemoveDefaults(schema).parse({});
      expect(result.string).toBeUndefined();
    });

    it('strips prefaulted object fields', () => {
      const schema = z.object({
        string: z.string().prefault('foo'),
      });
      const result = deepRemoveDefaults(schema).parse({});
      expect(result.string).toBeUndefined();
    });

    it('keeps non-defaulted object fields required', () => {
      const schema = z.object({
        required: z.string(),
      });
      const result = deepRemoveDefaults(schema).safeParse({});
      expect(result.success).toBe(false);
    });

    it('keeps explicitly optional fields optional', () => {
      const schema = z.object({
        maybe: z.string().optional(),
      });
      const result = deepRemoveDefaults(schema).safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maybe).toBeUndefined();
      }
    });

    it('does not double-wrap an already optional field when stripping', () => {
      const schema = z.object({
        value: z.string().optional().default('x'),
      });
      const stripped = deepRemoveDefaults(schema);
      const field = stripped.shape.value;
      expect(field).toBeInstanceOf(z.ZodOptional);
      expect(field.unwrap()).toBeInstanceOf(z.ZodString);
      expect(stripped.parse({}).value).toBeUndefined();
    });

    it('makes union-defaulted fields optional', () => {
      const schema = z.object({
        x: z.union([z.string().default(''), z.number().default(0)]),
      });
      const parsed = deepRemoveDefaults(schema).safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.x).toBeUndefined();
      }
    });

    it('keeps union fields required when no union option has defaults', () => {
      const schema = z.object({
        x: z.union([z.string(), z.number()]),
      });
      const parsed = deepRemoveDefaults(schema).safeParse({});
      expect(parsed.success).toBe(false);
    });

    it('detects defaults under nullable wrappers for optionalization', () => {
      const schema = z.object({
        maybe: z.string().default('x').nullable(),
      });
      const result = deepRemoveDefaults(schema).safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maybe).toBeUndefined();
      }
    });

    it('detects defaults under readonly wrappers for optionalization', () => {
      const schema = z.object({
        readOnlyValue: z.string().default('x').readonly(),
      });
      const result = deepRemoveDefaults(schema).safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.readOnlyValue).toBeUndefined();
      }
    });

    it('detects defaults under nonoptional wrappers for optionalization', () => {
      const schema = z.object({
        strictValue: z.string().default('x').nonoptional(),
      });
      const result = deepRemoveDefaults(schema).safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strictValue).toBeUndefined();
      }
    });

    it('detects defaults under pipe wrappers for optionalization', () => {
      const schema = z.object({
        piped: z.string().default('x').pipe(z.string().min(1)),
      });
      const result = deepRemoveDefaults(schema).safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.piped).toBeUndefined();
      }
    });
  });

  describe('root wrapper stripping', () => {
    it('strips a root default wrapper', () => {
      const schema = z.string().default('foo');
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(false);
      expect(stripped.parse('bar')).toBe('bar');
    });

    it('strips a root prefault wrapper', () => {
      const schema = z.string().prefault('foo');
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(false);
      expect(stripped.parse('bar')).toBe('bar');
    });

    it('returns leaf schemas as-is when no changes are needed', () => {
      const schema = z.string().min(1);
      const stripped = deepRemoveDefaults(schema);
      expect(stripped).toBe(schema);
      expect(stripped.safeParse('').success).toBe(false);
    });
  });

  describe('container schemas', () => {
    it('strips defaults from array element schemas', () => {
      const schema = z.array(z.string().default('foo'));
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse([undefined]).success).toBe(false);
      expect(stripped.safeParse(['ok']).success).toBe(true);
    });

    it('still enforces array length constraints', () => {
      expect(deepRemoveDefaults(z.number().array().min(1)).safeParse([]).success).toBe(
        false,
      );
      expect(
        deepRemoveDefaults(z.number().array().max(1)).safeParse([1, 2]).success,
      ).toBe(false);
      expect(
        deepRemoveDefaults(z.number().array().length(1)).safeParse([]).success,
      ).toBe(false);
    });

    it('strips defaults from tuple items when tuple has no rest', () => {
      const schema = z.tuple([z.string().default('foo')]);
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse([]).success).toBe(false);
      expect(stripped.safeParse([undefined]).success).toBe(false);
      expect(stripped.safeParse(['ok']).success).toBe(true);
    });

    it('strips defaults from tuple items and tuple rest', () => {
      const schema = z.tuple([z.string().default('foo')], z.number().default(1));
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse([undefined]).success).toBe(false);
      expect(stripped.safeParse(['ok', undefined]).success).toBe(false);
      expect(stripped.safeParse(['ok', 2]).success).toBe(true);
    });

    it('strips defaults from all union options', () => {
      const schema = z.union([z.string().default('foo'), z.number().default(1)]);
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(false);
      expect(stripped.safeParse('ok').success).toBe(true);
      expect(stripped.safeParse(2).success).toBe(true);
    });
  });

  describe('recursive and cache behavior', () => {
    it('handles lazy schemas while stripping nested defaults', () => {
      const schema = z.lazy(() =>
        z.object({
          value: z.string().default('foo'),
        }),
      );
      const stripped = deepRemoveDefaults(schema);
      const parsed = stripped.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.value).toBeUndefined();
      }
    });

    it('handles getter-based recursive objects without stack overflow', () => {
      const categorySchema = z.object({
        name: z.string().default('root'),
        get children() {
          return z.array(categorySchema).default([]);
        },
      });

      const stripped = deepRemoveDefaults(categorySchema);
      const result = stripped.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBeUndefined();
        expect(result.data.children).toBeUndefined();
      }

      // Force recursive traversal so the forward-reference lazy callback is executed.
      const nested = stripped.safeParse({
        children: [
          {
            children: [{}],
          },
        ],
      });
      expect(nested.success).toBe(true);
    });

    it('handles self-referential lazy schemas in default detection', () => {
      const self: z.ZodType = z.lazy(() => self);
      const schema = z.object({
        node: self,
      });

      const stripped = deepRemoveDefaults(schema);
      expect(stripped.shape.node).toBeInstanceOf(z.ZodLazy);
      expect(stripped.shape.node).not.toBeInstanceOf(z.ZodOptional);
    });

    it('reuses cached child transforms for shared schema instances', () => {
      const shared = z.string().default('foo');
      const schema = z.object({
        a: shared,
        b: shared,
      });

      const stripped = deepRemoveDefaults(schema);
      const a = stripped.shape.a;
      const b = stripped.shape.b;
      expect(a).toBeInstanceOf(z.ZodOptional);
      expect(b).toBeInstanceOf(z.ZodOptional);
      expect(a.unwrap()).toBe(b.unwrap());
    });
  });

  describe('pipe and single-child wrappers', () => {
    it('strips defaults from pipe output schemas', () => {
      const schema = z.string().optional().pipe(z.string().default('bar'));
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(false);
      expect(stripped.safeParse('ok').success).toBe(true);
    });

    it('strips defaults inside optional wrappers', () => {
      const schema = z.string().default('foo').optional();
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(true);
      expect(stripped.safeParse('ok').success).toBe(true);
      expect(stripped.safeParse(1).success).toBe(false);
    });

    it('strips defaults inside nullable wrappers', () => {
      const schema = z.string().default('foo').nullable();
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(null).success).toBe(true);
      expect(stripped.safeParse(undefined).success).toBe(false);
    });

    it('strips defaults inside readonly wrappers', () => {
      const schema = z.string().default('foo').readonly();
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse('ok').success).toBe(true);
      expect(stripped.safeParse(undefined).success).toBe(false);
    });

    it('strips defaults inside nonoptional wrappers', () => {
      const schema = z.string().optional().default('foo').nonoptional();
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(false);
      expect(stripped.safeParse('ok').success).toBe(true);
    });

    it('strips defaults inside catch wrappers', () => {
      const schema = z.string().default('foo').catch('fallback');
      const stripped = deepRemoveDefaults(schema);
      const parsed = stripped.safeParse(undefined);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('fallback');
      }
    });

    it('strips defaults inside success wrappers', () => {
      const schema = z.success(z.string().default('foo'));
      const stripped = deepRemoveDefaults(schema);
      expect(stripped.safeParse(undefined).success).toBe(false);
      expect(stripped.parse('ok')).toBe(true);
    });

    it('strips defaults inside promise wrappers', async () => {
      const schema = z.promise(z.string().default('foo'));
      const stripped = deepRemoveDefaults(schema);

      const missing = await stripped.safeParseAsync(Promise.resolve(undefined));
      expect(missing.success).toBe(false);

      const present = await stripped.safeParseAsync(Promise.resolve('ok'));
      expect(present.success).toBe(true);
      if (present.success) {
        expect(present.data).toBe('ok');
      }
    });

    it('throws when a wrapper unwraps to a non-classic schema value', () => {
      const schema = z.string().nullable();
      Object.defineProperty(schema, 'unwrap', {
        value: () => ({}) as unknown as z.core.$ZodType,
      });

      expect(() => deepRemoveDefaults(schema)).toThrowError(
        'deepRemoveDefaults supports full zod schemas only',
      );
    });
  });
});
