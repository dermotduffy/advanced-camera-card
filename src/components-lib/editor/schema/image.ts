import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { getImageFieldsSchema } from './common/image';
import { getProxySchema } from './common/proxy';

/**
 * Get the section forms for the image section.
 * @returns The section forms.
 */
export const getImageSectionForms = (): EditorForm[] => [
  {
    basePath: ['image'],
    schema: [
      ...getImageFieldsSchema(),
      {
        name: 'zoomable',
        selector: { boolean: {} },
      },
      getProxySchema({
        title: localize('config.common.image.proxy.editor_label'),
        includeEnabled: true,
      }),
    ],
  },
];
