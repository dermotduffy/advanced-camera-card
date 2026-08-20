import { isRecord } from '../../../../utils/basic';

const COMPOSITE_CONDITION_OPERATORS = ['and', 'or', 'not'] as const;

/**
 * Recognize a composite condition in any of the three formats that Home
 * Assistant accepts:
 *   - `{condition: <op>, conditions: [...]}` -- the canonical form.
 *   - `{and|or|not: [...]}` -- the boolean operator is the key.
 *   - `{condition: [...]}` -- a list under the discriminator is an implicit AND.
 *
 * @param value The value to inspect.
 * @returns The key the inner conditions are held under, which differs between
 * the spellings, or `null` if the value is not a composite condition.
 */
export const getCompositeConditionsKey = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (Array.isArray(value.condition)) {
    return 'condition';
  }
  if ('condition' in value) {
    return COMPOSITE_CONDITION_OPERATORS.some((op) => op === value.condition)
      ? 'conditions'
      : null;
  }
  const present = COMPOSITE_CONDITION_OPERATORS.filter((op) => op in value);
  return present.length === 1 ? present[0] : null;
};

/**
 * Expand Home Assistant's composite shorthand to the canonical `{condition:
 * <op>, conditions: [...]}` form.
 *
 * @param value The value to expand.
 * @returns The canonical form, or the value untouched if it is not shorthand.
 */
export const expandCompositeShorthand = (value: unknown): unknown => {
  const key = getCompositeConditionsKey(value);
  if (!key || !isRecord(value) || key === 'conditions') {
    return value;
  }
  const { [key]: conditions, ...rest } = value;
  // A list under the discriminator is an implicit `and`; every other shorthand
  // names its own operator.
  return { ...rest, condition: key === 'condition' ? 'and' : key, conditions };
};
