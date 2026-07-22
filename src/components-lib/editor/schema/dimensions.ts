import type { HASelectSelectorOption } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createSelectSelector } from './common/selectors';

/**
 * Get the options for how the card's aspect ratio is decided.
 * @returns The aspect ratio mode options.
 */
export const getAspectRatioModeOptions = (): HASelectSelectorOption[] => [
  {
    value: 'dynamic',
    label: localize('config.dimensions.aspect_ratio_modes.dynamic'),
  },
  {
    value: 'static',
    label: localize('config.dimensions.aspect_ratio_modes.static'),
  },
  {
    value: 'unconstrained',
    label: localize('config.dimensions.aspect_ratio_modes.unconstrained'),
  },
];

/**
 * Get the form for the dimensions section.
 * @returns The section forms.
 */
export const getDimensionsSectionForms = (): EditorForm[] => [
  {
    basePath: ['dimensions'],
    schema: [
      {
        name: 'aspect_ratio_mode',
        selector: createSelectSelector(getAspectRatioModeOptions()),
      },
      {
        name: 'aspect_ratio',
        selector: { text: {} },
      },
      {
        name: 'height',
        selector: { text: {} },
      },
    ],
  },
];
