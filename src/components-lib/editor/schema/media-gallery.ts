import type { HAFormExpandableSchema } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { getThumbnailsSchema } from './common/controls/thumbnails';
import { createSelectSelector } from './common/selectors';

const getFilterSchema = (): HAFormExpandableSchema => ({
  name: 'filter',
  type: 'expandable',
  title: localize('config.common.controls.filter.editor_label'),
  icon: 'mdi:filter-cog',
  schema: [
    {
      name: 'mode',
      label: localize('config.common.controls.filter.mode'),
      selector: createSelectSelector([
        { value: 'none', label: localize('config.common.controls.filter.modes.none') },
        { value: 'left', label: localize('config.common.controls.filter.modes.left') },
        { value: 'right', label: localize('config.common.controls.filter.modes.right') },
      ]),
    },
  ],
});

/**
 * Get the form for the media gallery section.
 * @returns The section forms.
 */
export const getMediaGallerySectionForms = (): EditorForm[] => [
  {
    basePath: ['media_gallery', 'controls'],
    schema: [getThumbnailsSchema(), getFilterSchema()],
  },
];
