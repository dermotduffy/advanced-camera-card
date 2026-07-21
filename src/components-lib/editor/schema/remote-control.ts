import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createSelectSelector } from './common/selectors';

/**
 * Get the form for the remote control section.
 * @returns The section forms.
 */
export const getRemoteControlSectionForms = (): EditorForm[] => [
  {
    basePath: ['remote_control'],
    schema: [
      {
        name: 'entities',
        type: 'expandable',
        title: localize('config.remote_control.entities.editor_label'),
        icon: 'mdi:devices',
        schema: [
          {
            name: 'camera',
            selector: { entity: { domain: 'input_select' } },
          },
          {
            name: 'camera_priority',
            selector: createSelectSelector([
              {
                value: 'card',
                label: localize('config.remote_control.entities.camera_priorities.card'),
              },
              {
                value: 'entity',
                label: localize(
                  'config.remote_control.entities.camera_priorities.entity',
                ),
              },
            ]),
          },
        ],
      },
    ],
  },
];
