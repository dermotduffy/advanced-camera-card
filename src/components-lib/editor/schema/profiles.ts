import type { HAFormSchema } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createSelectSelector } from './common/selectors';

/**
 * Get the field choosing which pre-configured sets of defaults apply.
 * @returns The profiles field.
 */
export const getProfilesField = (): HAFormSchema => ({
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
});

/**
 * Get the form for the profiles section.
 * @returns The section forms.
 */
export const getProfilesSectionForms = (): EditorForm[] => [
  {
    basePath: [],
    schema: [getProfilesField()],
  },
];
