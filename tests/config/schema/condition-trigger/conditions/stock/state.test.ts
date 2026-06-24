import { describe, expect, it } from 'vitest';

import { stateConditionSchema } from '../../../../../../src/config/schema/condition-trigger/conditions/stock/state';

describe('stateConditionSchema', () => {
  it('should reject a state condition without state or state_not', () => {
    expect(() =>
      stateConditionSchema.parse({
        condition: 'state',
        entity_id: 'binary_sensor.door',
      }),
    ).toThrow();
  });

  it('should accept a state condition with state', () => {
    expect(
      stateConditionSchema.parse({
        condition: 'state',
        entity_id: 'binary_sensor.door',
        state: 'on',
      }),
    ).toEqual({ condition: 'state', entity_id: 'binary_sensor.door', state: 'on' });
  });

  it('should accept a state condition with state_not', () => {
    expect(
      stateConditionSchema.parse({
        condition: 'state',
        entity_id: 'binary_sensor.door',
        state_not: 'on',
      }),
    ).toEqual({ condition: 'state', entity_id: 'binary_sensor.door', state_not: 'on' });
  });
});
