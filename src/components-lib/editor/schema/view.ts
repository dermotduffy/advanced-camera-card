import type { HASelectSelectorOption } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { getInteractionModeOptions } from './common/interaction-mode';
import { createNumberSelector, createSelectSelector } from './common/selectors';

const getViewModeOptions = (): HASelectSelectorOption[] => [
  { value: 'auto', label: localize('config.view.views.auto') },
  { value: 'clip', label: localize('config.view.views.clip') },
  { value: 'clips', label: localize('config.view.views.clips') },
  { value: 'diagnostics', label: localize('config.view.views.diagnostics') },
  { value: 'folder', label: localize('config.view.views.folder') },
  { value: 'folders', label: localize('config.view.views.folders') },
  { value: 'gallery', label: localize('config.view.views.gallery') },
  { value: 'image', label: localize('config.view.views.image') },
  { value: 'live', label: localize('config.view.views.live') },
  { value: 'media', label: localize('config.view.views.media') },
  { value: 'recording', label: localize('config.view.views.recording') },
  { value: 'recordings', label: localize('config.view.views.recordings') },
  { value: 'review', label: localize('config.view.views.review') },
  { value: 'reviews', label: localize('config.view.views.reviews') },
  { value: 'snapshot', label: localize('config.view.views.snapshot') },
  { value: 'snapshots', label: localize('config.view.views.snapshots') },
  { value: 'timeline', label: localize('config.view.views.timeline') },
];

/**
 * Get the form for the view section (excluding the keyboard shortcuts, which
 * render in their own panel).
 * @param options The entity IDs offered for entity fields.
 * @returns The section forms.
 */
export const getViewSectionForms = (): EditorForm[] => [
  {
    basePath: ['view'],
    schema: [
      {
        name: 'default',
        selector: createSelectSelector(getViewModeOptions()),
      },
      {
        name: 'camera_select',
        selector: createSelectSelector([
          ...getViewModeOptions(),
          { value: 'current', label: localize('config.view.views.current') },
        ]),
      },
      {
        name: 'dim',
        selector: { boolean: {} },
      },
      {
        name: 'interaction_seconds',
        selector: createNumberSelector(),
      },
      {
        name: 'default_cycle_camera',
        selector: { boolean: {} },
      },
      {
        name: 'default_reset',
        type: 'expandable',
        title: localize('config.view.default_reset.editor_label'),
        icon: 'mdi:restart',
        schema: [
          {
            name: 'after_interaction',
            selector: { boolean: {} },
          },
          {
            name: 'every_seconds',
            selector: createNumberSelector(),
          },
          {
            name: 'interaction_mode',
            label: localize('config.view.default_reset.interaction_mode'),
            selector: createSelectSelector(getInteractionModeOptions()),
          },
          {
            name: 'entities',
            selector: { entity: { multiple: true } },
          },
        ],
      },
      {
        name: 'issues',
        type: 'expandable',
        title: localize('config.view.issues.editor_label'),
        icon: 'mdi:alert-circle-outline',
        schema: [
          {
            name: 'interaction_mode',
            label: localize('config.view.issues.interaction_mode'),
            selector: createSelectSelector(getInteractionModeOptions()),
          },
          {
            name: 'retry_seconds',
            selector: createNumberSelector(),
          },
        ],
      },
      {
        name: 'triggers',
        type: 'expandable',
        title: localize('config.view.triggers.editor_label'),
        icon: 'mdi:target-account',
        schema: [
          {
            name: 'filter_selected_camera',
            selector: { boolean: {} },
          },
          {
            name: 'show_trigger_status',
            selector: { boolean: {} },
          },
          {
            name: 'untrigger_delay_seconds',
            selector: createNumberSelector(),
          },
          {
            name: 'untrigger_force_seconds',
            selector: createNumberSelector(),
          },
          {
            name: 'event_hold_seconds',
            selector: createNumberSelector(),
          },
          {
            name: 'actions',
            type: 'expandable',
            title: localize('config.view.triggers.actions.editor_label'),
            icon: 'mdi:cogs',
            schema: [
              {
                name: 'trigger',
                label: localize('config.view.triggers.actions.trigger'),
                selector: createSelectSelector([
                  {
                    value: 'call',
                    label: localize('config.view.triggers.actions.triggers.call'),
                  },
                  {
                    value: 'default',
                    label: localize('config.view.triggers.actions.triggers.default'),
                  },
                  {
                    value: 'live',
                    label: localize('config.view.triggers.actions.triggers.live'),
                  },
                  {
                    value: 'media',
                    label: localize('config.view.triggers.actions.triggers.media'),
                  },
                  {
                    value: 'none',
                    label: localize('config.view.triggers.actions.triggers.none'),
                  },
                  {
                    value: 'update',
                    label: localize('config.view.triggers.actions.triggers.update'),
                  },
                ]),
              },
              {
                name: 'untrigger',
                label: localize('config.view.triggers.actions.untrigger'),
                selector: createSelectSelector([
                  {
                    value: 'call',
                    label: localize('config.view.triggers.actions.untriggers.call'),
                  },
                  {
                    value: 'default',
                    label: localize('config.view.triggers.actions.untriggers.default'),
                  },
                  {
                    value: 'none',
                    label: localize('config.view.triggers.actions.untriggers.none'),
                  },
                ]),
              },
              {
                name: 'interaction_mode',
                label: localize('config.view.triggers.actions.interaction_mode'),
                selector: createSelectSelector(getInteractionModeOptions()),
              },
            ],
          },
        ],
      },
    ],
  },
  // `themes` is the only configurable key under `view.theme` (`overrides` is
  // free-form CSS kept YAML-only), so it renders bare rather than in an
  // expandable panel. The separate `EditorForm` exists only to nest it under
  // `theme` via its `basePath`.
  {
    basePath: ['view', 'theme'],
    schema: [
      {
        name: 'themes',
        label: localize('config.view.theme.themes.editor_label'),
        selector: createSelectSelector(
          [
            { value: 'ha', label: localize('config.view.theme.themes.ha') },
            { value: 'dark', label: localize('config.view.theme.themes.dark') },
            { value: 'light', label: localize('config.view.theme.themes.light') },
            {
              value: 'traditional',
              label: localize('config.view.theme.themes.traditional'),
            },
          ],
          { multiple: true },
        ),
      },
    ],
  },
];

/**
 * Get the form for the keyboard shortcuts panel. Only the enabled flag is a
 * form field: a keystroke cannot be captured by any `ha-form` selector, so each
 * shortcut in `PTZ_KEYBOARD_SHORTCUTS` is rendered by a key assigner widget
 * instead.
 * @returns The section forms.
 */
export const getViewKeyboardShortcutsSectionForms = (): EditorForm[] => [
  {
    basePath: ['view', 'keyboard_shortcuts'],
    schema: [
      {
        name: 'enabled',
        selector: { boolean: {} },
      },
    ],
  },
];
