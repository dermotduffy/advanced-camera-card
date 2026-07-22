import {
  isFormFieldSchema,
  isNumberFieldSelector,
  type HAFormGridSchema,
  type HAFormSchema,
} from '../../../../ha/types';

// The width a column may shrink to before the fields fall back to one per row.
// Narrower than `ha-form`'s own 200px default, which a row nested inside a
// couple of groups can no longer reach: each enclosing panel insets its
// contents, so a field deep in the form has appreciably less width to divide
// than one at the top of a section.
const COLUMN_MIN_WIDTH = '150px';

/**
 * Show a number as an input box rather than a slider, since a slider writes its
 * label above its control while every other kind of field writes it inside, so
 * a slider beside anything else leaves the two sitting at different heights and
 * looks odd. A slider is also arguably a poor use of a column's width.
 * @param field The field to show as a box.
 * @returns The field, as a box if it is a number.
 */
const asBoxedNumber = (field: HAFormSchema): HAFormSchema =>
  isFormFieldSchema(field) && isNumberFieldSelector(field.selector)
    ? {
        ...field,
        selector: { number: { ...field.selector.number, mode: 'box' } },
      }
    : field;

/**
 * Lay fields out in columns rather than one per row.
 * @param schema The fields to lay out.
 * @returns A grid of the fields.
 */
export const createGrid = (schema: HAFormSchema[]): HAFormGridSchema => ({
  type: 'grid',
  column_min_width: COLUMN_MIN_WIDTH,
  schema: schema.map(asBoxedNumber),
});
