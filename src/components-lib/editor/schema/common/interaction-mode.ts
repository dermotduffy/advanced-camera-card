import type { HASelectSelectorOption } from '../../../../ha/types';
import { localize } from '../../../../localize/localize';

/**
 * Get the options for an interaction mode select.
 * @returns The select options.
 */
export const getInteractionModeOptions = (): HASelectSelectorOption[] => [
  { value: 'all', label: localize('config.common.interaction_modes.all') },
  { value: 'inactive', label: localize('config.common.interaction_modes.inactive') },
  { value: 'active', label: localize('config.common.interaction_modes.active') },
];
