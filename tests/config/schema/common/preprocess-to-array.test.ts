import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { preprocessToArray } from '../../../../src/config/schema/common/preprocess-to-array';

const schema = z.object({
  items: preprocessToArray(z.object({ name: z.string() }).array()).optional(),
});

describe('preprocessToArray', () => {
  it('should keep a list as it is', () => {
    expect(schema.parse({ items: [{ name: 'office' }] })).toEqual({
      items: [{ name: 'office' }],
    });
  });

  it('should normalise a single item to a list', () => {
    expect(schema.parse({ items: { name: 'office' } })).toEqual({
      items: [{ name: 'office' }],
    });
  });

  it('should read a key written with no value as a list of nothing', () => {
    expect(schema.parse({ items: null })).toEqual({ items: [] });
  });

  it('should leave an absent optional field absent', () => {
    expect(schema.parse({})).toEqual({});
  });
});
