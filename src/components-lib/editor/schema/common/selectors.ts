import type {
  HANumberSelector,
  HASelectSelector,
  HASelectSelectorOption,
} from '../../../../ha/types';

/**
 * Create a dropdown select selector. Free-form values are allowed only when
 * no options are given.
 * @param options The options to offer.
 * @param params Whether multiple values may be selected.
 * @returns A select selector.
 */
export const createSelectSelector = (
  options: string[] | HASelectSelectorOption[],
  params?: { multiple?: boolean },
): HASelectSelector => ({
  select: {
    mode: 'dropdown',
    multiple: !!params?.multiple,
    custom_value: !options.length,
    options,
  },
});

/**
 * Create a number selector: a slider when bounded by a maximum, otherwise an
 * input box.
 * @param params The bounds and step size.
 * @returns A number selector.
 */
export const createNumberSelector = (params?: {
  min?: number;
  max?: number;
  step?: number;
}): HANumberSelector => ({
  number: {
    min: params?.min ?? 0,
    max: params?.max,
    mode: params?.max === undefined ? 'box' : 'slider',
    step: params?.step,
  },
});
