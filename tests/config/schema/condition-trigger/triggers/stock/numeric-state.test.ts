import { describe, expect, it } from 'vitest';

import { numericStateTriggerSchema } from '../../../../../../src/config/schema/condition-trigger/triggers/stock/numeric-state';

describe('numericStateTriggerSchema', () => {
  it('should reject a numeric_state trigger with neither above nor below', () => {
    expect(() =>
      numericStateTriggerSchema.parse({
        trigger: 'numeric_state',
        entity_id: 'sensor.temperature',
      }),
    ).toThrow();
  });

  it('should reject a literal above greater than below (an impossible band)', () => {
    expect(() =>
      numericStateTriggerSchema.parse({
        trigger: 'numeric_state',
        entity_id: 'sensor.temperature',
        above: 20,
        below: 10,
      }),
    ).toThrow();
  });

  it('should accept a literal above not greater than below', () => {
    expect(
      numericStateTriggerSchema.parse({
        trigger: 'numeric_state',
        entity_id: 'sensor.temperature',
        above: 10,
        below: 20,
      }),
    ).toEqual({
      trigger: 'numeric_state',
      entity_id: 'sensor.temperature',
      above: 10,
      below: 20,
    });
  });

  it('should accept an entity-reference threshold', () => {
    expect(
      numericStateTriggerSchema.parse({
        trigger: 'numeric_state',
        entity_id: 'sensor.temperature',
        above: 'input_number.high',
        below: 10,
      }),
    ).toEqual({
      trigger: 'numeric_state',
      entity_id: 'sensor.temperature',
      above: 'input_number.high',
      below: 10,
    });
  });

  it('should accept a single threshold', () => {
    expect(
      numericStateTriggerSchema.parse({
        trigger: 'numeric_state',
        entity_id: 'sensor.temperature',
        above: 25,
      }),
    ).toEqual({
      trigger: 'numeric_state',
      entity_id: 'sensor.temperature',
      above: 25,
    });
  });
});
