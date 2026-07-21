import type { EditorForm } from '../types';
import { getThumbnailsSchema } from './common/controls/thumbnails';
import { getTimelineCoreSchema } from './common/controls/timeline';

/**
 * Get the forms for the timeline section. The core timeline fields and the
 * thumbnail controls live under different configuration paths, so they render
 * as two forms.
 * @returns The section forms.
 */
export const getTimelineSectionForms = (): EditorForm[] => [
  {
    basePath: ['timeline'],
    schema: getTimelineCoreSchema(),
  },
  {
    basePath: ['timeline', 'controls'],
    schema: [getThumbnailsSchema({ includeMode: true })],
  },
];
