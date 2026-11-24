import type { HAFormSelectorSchema } from '../../../../ha/types';

const formatAspectRatio = (value: unknown): unknown =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((dimension) => typeof dimension === 'number')
    ? value.join(':')
    : value;

/**
 * Create a text field for an aspect ratio. A ratio may be configured as text
 * (`'16:9'`) or as a pair of numbers (`[16, 9]`). The field shows a pair as
 * text that parses back into the same pair.
 * @param label The label, if not the one derived from the field's path.
 * @returns The field.
 */
export const createAspectRatioField = (label?: string): HAFormSelectorSchema => ({
  name: 'aspect_ratio',
  label,
  selector: { text: {} },
  formatDisplayed: formatAspectRatio,
});
