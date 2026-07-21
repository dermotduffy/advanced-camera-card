import type { HAFormSchema } from '../../../../ha/types';
import { localize } from '../../../../localize/localize';
import { createNumberSelector, createSelectSelector } from './selectors';

/**
 * Get the schema for a set of image source fields.
 * @returns The form schema.
 */
export const getImageFieldsSchema = (): HAFormSchema[] => [
  {
    name: 'mode',
    label: localize('config.common.image.mode'),
    selector: createSelectSelector([
      { value: 'auto', label: localize('config.common.image.modes.auto') },
      { value: 'camera', label: localize('config.common.image.modes.camera') },
      { value: 'default', label: localize('config.common.image.modes.default') },
      { value: 'entity', label: localize('config.common.image.modes.entity') },
      {
        value: 'screensaver',
        label: localize('config.common.image.modes.screensaver'),
      },
      { value: 'url', label: localize('config.common.image.modes.url') },
    ]),
  },
  {
    name: 'url',
    label: localize('config.common.image.url'),
    selector: { text: {} },
  },
  {
    name: 'entity',
    label: localize('config.common.image.entity'),
    selector: { entity: {} },
  },
  {
    name: 'entity_parameters',
    label: localize('config.common.image.entity_parameters'),
    selector: { text: {} },
  },
  {
    name: 'refresh_seconds',
    label: localize('config.common.image.refresh_seconds'),
    selector: createNumberSelector(),
  },
];
