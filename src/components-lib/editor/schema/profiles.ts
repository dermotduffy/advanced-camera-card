import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createSelectSelector } from './common/selectors';

/**
 * Get the form for the profiles section.
 * @returns The section forms.
 */
export const getProfilesSectionForms = (): EditorForm[] => [
  {
    basePath: [],
    schema: [
      {
        name: 'profiles',
        label: localize('config.profiles.editor_label'),
        selector: createSelectSelector(
          [
            { value: 'casting', label: localize('config.profiles.casting') },
            { value: 'doorbell', label: localize('config.profiles.doorbell') },
            {
              value: 'low-performance',
              label: localize('config.profiles.low-performance'),
            },
            { value: 'scrubbing', label: localize('config.profiles.scrubbing') },
          ],
          { multiple: true },
        ),
      },
    ],
  },
];
