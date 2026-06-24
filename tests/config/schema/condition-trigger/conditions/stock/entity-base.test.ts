import { describe, expect, it } from 'vitest';

import { entityConditionBaseSchema } from '../../../../../../src/config/schema/condition-trigger/conditions/stock/entity-base';

describe('entityConditionBaseSchema', () => {
  it('should reject when neither entity nor entity_id are provided', () => {
    expect(() => entityConditionBaseSchema.parse({})).toThrow();
  });
});
