import { describe, expect, it } from 'vitest';
import { stateConditionSchema } from '../../../../../src/config/schema/conditions/stock/state';

// Covers the card's own refinement (zod pass-through is trusted): `for` requires
// `state` (or its accepted `state_not` alias).
describe('stateConditionSchema', () => {
  it('should reject for without state or state_not', () => {
    expect(() =>
      stateConditionSchema.parse({
        condition: 'state',
        entity_id: 'binary_sensor.door',
        for: '00:00:05',
      }),
    ).toThrow();
  });
});
