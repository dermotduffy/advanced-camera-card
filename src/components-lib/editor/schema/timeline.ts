import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { getThumbnailsSchema } from './common/controls/thumbnails';
import { getTimelineCoreSchema } from './common/controls/timeline';
import { createNumberSelector } from './common/selectors';

/**
 * Get the forms for the timeline section. The core timeline fields and the
 * thumbnail controls live under different configuration paths, so they render
 * as two forms.
 * @returns The section forms.
 */
export const getTimelineSectionForms = (): EditorForm[] => [
  {
    basePath: ['timeline'],
    schema: [
      ...getTimelineCoreSchema(),
      {
        name: 'recording_retention_hours',
        label: localize('config.common.timeline.recording_retention_hours'),
        selector: createNumberSelector({ min: 0, max: 24, step: 1 }),
      },
    ],
  },
  {
    basePath: ['timeline', 'controls'],
    schema: [getThumbnailsSchema({ includeMode: true })],
  },
];
