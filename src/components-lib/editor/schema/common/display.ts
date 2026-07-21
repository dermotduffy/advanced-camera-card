import type { HAFormExpandableSchema } from '../../../../ha/types';
import { localize } from '../../../../localize/localize';
import { createNumberSelector, createSelectSelector } from './selectors';

/**
 * Get the schema for the view display controls (single vs grid layout).
 * @returns The form schema.
 */
export const getDisplaySchema = (): HAFormExpandableSchema => ({
  name: 'display',
  type: 'expandable',
  title: localize('config.common.display.editor_label'),
  icon: 'mdi:palette-swatch',
  schema: [
    {
      name: 'mode',
      label: localize('config.common.display.mode'),
      selector: createSelectSelector([
        { value: 'single', label: localize('display_modes.single') },
        { value: 'grid', label: localize('display_modes.grid') },
      ]),
    },
    {
      name: 'grid_selected_position',
      label: localize('config.common.display.grid_selected_position'),
      selector: createSelectSelector([
        {
          value: 'default',
          label: localize('config.common.display.grid_selected_positions.default'),
        },
        {
          value: 'first',
          label: localize('config.common.display.grid_selected_positions.first'),
        },
        {
          value: 'last',
          label: localize('config.common.display.grid_selected_positions.last'),
        },
      ]),
    },
    {
      name: 'grid_selected_width_factor',
      label: localize('config.common.display.grid_selected_width_factor'),
      selector: createNumberSelector({ min: 0 }),
    },
    {
      name: 'grid_columns',
      label: localize('config.common.display.grid_columns'),
      selector: createNumberSelector({ min: 0 }),
    },
    {
      name: 'grid_max_columns',
      label: localize('config.common.display.grid_max_columns'),
      selector: createNumberSelector({ min: 0 }),
    },
  ],
});
