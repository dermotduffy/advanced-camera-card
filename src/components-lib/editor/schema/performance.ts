import { MEDIA_CHUNK_SIZE_MAX } from '../../../config/schema/performance';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createGrid } from './common/grid';
import { createNumberSelector } from './common/selectors';

/**
 * Get the form for the performance section (except the low-performance profile
 * warning, which is a custom info row).
 * @returns The section forms.
 */
export const getPerformanceSectionForms = (): EditorForm[] => [
  {
    basePath: ['performance'],
    schema: [
      {
        name: 'features',
        type: 'expandable',
        title: localize('config.performance.features.editor_label'),
        icon: 'mdi:feature-search',
        schema: [
          createGrid([
            { name: 'card_loading_indicator', selector: { boolean: {} } },
            { name: 'card_loading_effects', selector: { boolean: {} } },
            { name: 'animated_progress_indicator', selector: { boolean: {} } },
          ]),
          createGrid([
            {
              name: 'media_chunk_size',
              selector: createNumberSelector({ max: MEDIA_CHUNK_SIZE_MAX }),
            },
            {
              name: 'max_simultaneous_engine_requests',
              selector: createNumberSelector({ min: 1 }),
            },
          ]),
        ],
      },
      {
        name: 'style',
        type: 'expandable',
        title: localize('config.performance.style.editor_label'),
        icon: 'mdi:palette-swatch-variant',
        schema: [
          createGrid([
            { name: 'border_radius', selector: { boolean: {} } },
            { name: 'box_shadow', selector: { boolean: {} } },
          ]),
        ],
      },
    ],
  },
];
