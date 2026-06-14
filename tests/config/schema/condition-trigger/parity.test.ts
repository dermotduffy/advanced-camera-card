import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { conditionSchema } from '../../../../src/config/schema/condition-trigger/conditions/types';
import { triggerSchema } from '../../../../src/config/schema/condition-trigger/triggers/types';

// Reads the discriminator literal (`condition`/`trigger`) from every member of
// a union, unwrapping the optional discriminator the state condition uses.
const getTypes = (
  options: readonly z.ZodType[],
  key: 'condition' | 'trigger',
): Set<string> => {
  const result = new Set<string>();
  for (const option of options) {
    if (!(option instanceof z.ZodObject)) {
      continue;
    }
    const field = option.shape[key];
    const literal = field instanceof z.ZodOptional ? field.unwrap() : field;
    if (literal instanceof z.ZodLiteral) {
      result.add(String(literal.value));
    }
  }
  return result;
};

// HA conditions have `or`/`and`/`not` composites; HA triggers do not (a flat
// trigger list is an implicit OR). So triggers = conditions minus the
// composites.
const COMPOSITES = ['or', 'and', 'not'];

// `config` only ever detects a change, so it is a trigger but not a condition.
const TRIGGER_ONLY = ['config'];

// `user`/`user_agent` are static per session, so they are conditions but not
// triggers.
const CONDITION_ONLY = ['user', 'user_agent'];

// Verify the same (except composite) types are defined in both condition and
// trigger schemas.
describe('condition/trigger schema parity', () => {
  it('should keep condition and trigger leaf types in sync', () => {
    // Apart from the documented exceptions below, conditions and triggers stay
    // paired: adding a leaf type to one without the other (or without recording
    // it as an exception) is a bug (the fields may still differ).
    const conditionTypes = getTypes(conditionSchema.options, 'condition');
    const triggerTypes = getTypes(triggerSchema.options, 'trigger');

    // Triggers have no composites (as per HA standard).
    expect(COMPOSITES.some((c) => triggerTypes.has(c))).toBe(false);

    // Conditions have composites.
    expect(COMPOSITES.every((c) => conditionTypes.has(c))).toBe(true);

    // TRIGGER_ONLY are ... trigger-only.
    expect(TRIGGER_ONLY.every((c) => triggerTypes.has(c))).toBe(true);
    expect(TRIGGER_ONLY.some((c) => conditionTypes.has(c))).toBe(false);

    // CONDITION_ONLY are ... condition-only.
    expect(CONDITION_ONLY.every((c) => conditionTypes.has(c))).toBe(true);
    expect(CONDITION_ONLY.some((c) => triggerTypes.has(c))).toBe(false);

    // Otherwise the leaf type sets are identical.
    const conditionLeaves = [...conditionTypes].filter(
      (t) => !COMPOSITES.includes(t) && !CONDITION_ONLY.includes(t),
    );
    const triggerLeaves = [...triggerTypes].filter((t) => !TRIGGER_ONLY.includes(t));

    expect(triggerLeaves.sort()).toEqual(conditionLeaves.sort());
  });
});
