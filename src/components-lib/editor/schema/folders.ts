import type { HAFormSchema } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import { createSelectSelector } from './common/selectors';

/**
 * Get the schema for a single folder. Array sections expose just the item
 * fields; the editor renders one form per folder at `basePath: ['folders', i]`.
 * @returns The form schema for one folder.
 */
export const getFolderSchema = (): HAFormSchema[] => [
  {
    name: 'type',
    selector: createSelectSelector([
      { value: 'ha', label: localize('config.folders.types.ha') },
    ]),
  },
  {
    name: 'title',
    selector: { text: {} },
  },
  {
    name: 'icon',
    selector: { icon: {} },
  },
  {
    name: 'id',
    selector: { text: {} },
  },
  {
    name: 'ha',
    type: 'expandable',
    title: localize('config.folders.ha.editor_label'),
    icon: 'mdi:home-assistant',
    schema: [
      {
        name: 'url',
        selector: { text: {} },
      },
    ],
  },
];
