import { describe, expect, it } from 'vitest';
import { numericStateConditionSchema } from '../../../../../../src/config/schema/condition-trigger/conditions/stock/numeric-state';

describe('numericStateConditionSchema', () => {
  it('should reject when neither above nor below is provided', () => {
    expect(() =>
      numericStateConditionSchema.parse({
        condition: 'numeric_state',
        entity_id: 'sensor.temperature',
      }),
    ).toThrow();
  });
});
