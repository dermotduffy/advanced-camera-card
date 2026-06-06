import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { conditionSchema } from '../../../../src/config/schema/conditions/types';
import { triggerSchema } from '../../../../src/config/schema/triggers/types';

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
// trigger list is an implicit OR). So triggers = conditions minus the composites.
const COMPOSITES = ['or', 'and', 'not'];

// Verify the same (except composite) types are defined in both condition and
// trigger schemas.
describe('triggerSchema', () => {
  it('should define the same set of types as conditionSchema, minus the composites', () => {
    // Conditions and triggers must stay paired: adding a leaf type to one
    // without the other is a bug (the fields may be different, though).
    const conditionTypes = getTypes(conditionSchema.options, 'condition');
    const triggerTypes = getTypes(triggerSchema.options, 'trigger');

    // Triggers have no composites (as per HA standard).
    expect(COMPOSITES.some((c) => triggerTypes.has(c))).toBe(false);

    // Conditions have composites.
    expect(COMPOSITES.every((c) => conditionTypes.has(c))).toBe(true);

    // Otherwise the leaf type sets are identical.
    const conditionLeaves = [...conditionTypes].filter((t) => !COMPOSITES.includes(t));

    expect([...triggerTypes].sort()).toEqual(conditionLeaves.sort());
  });
});
