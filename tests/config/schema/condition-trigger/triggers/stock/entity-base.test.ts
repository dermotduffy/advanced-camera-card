import { describe, expect, it } from 'vitest';

import { entityTriggerBaseSchema } from '../../../../../../src/config/schema/condition-trigger/triggers/stock/entity-base';

describe('entityTriggerBaseSchema', () => {
  it('should reject when neither entity nor entity_id are provided', () => {
    expect(() => entityTriggerBaseSchema.parse({})).toThrow();
  });
});
