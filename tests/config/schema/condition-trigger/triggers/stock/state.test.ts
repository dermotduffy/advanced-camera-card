import { describe, expect, it } from 'vitest';
import { stateTriggerSchema } from '../../../../../../src/config/schema/condition-trigger/triggers/stock/state';

// Covers the card's own refinements (zod pass-through is trusted): HA makes
// `from`/`not_from` and `to`/`not_to` mutually exclusive.
describe('stateTriggerSchema', () => {
  it('should reject from together with not_from', () => {
    expect(() =>
      stateTriggerSchema.parse({
        trigger: 'state',
        entity_id: 'binary_sensor.door',
        from: 'off',
        not_from: 'unavailable',
      }),
    ).toThrow();
  });

  it('should reject to together with not_to', () => {
    expect(() =>
      stateTriggerSchema.parse({
        trigger: 'state',
        entity_id: 'binary_sensor.door',
        to: 'on',
        not_to: 'unavailable',
      }),
    ).toThrow();
  });
});
