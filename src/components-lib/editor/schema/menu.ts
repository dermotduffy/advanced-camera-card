import { BUTTON_SIZE_MIN, MENU_PRIORITY_MAX } from '../../../config/schema/common/const';
import type {
  HAFormExpandableSchema,
  HAFormSchema,
  HASelectSelectorOption,
} from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createNumberSelector, createSelectSelector } from './common/selectors';

// The menu buttons in their display order.
export const MENU_BUTTONS = [
  // Iris menu button is first.
  'iris',

  // Alphabetical.
  'call',
  'camera_ui',
  'cameras',
  'clips',
  'display_mode',
  'download',
  'expand',
  'folders',
  'fullscreen',
  'gallery',
  'image',
  'info',
  'live',
  'media_player',
  'microphone',
  'mute',
  'pip',
  'play',
  'ptz_controls',
  'ptz_home',
  'recordings',
  'reviews',
  'screenshot',
  'set_review',
  'snapshots',
  'substreams',
  'timeline',
];

/**
 * Get the options for choosing a menu button.
 * @returns The menu buttons, in display order.
 */
export const getMenuButtonOptions = (): HASelectSelectorOption[] =>
  MENU_BUTTONS.map((button) => ({
    value: button,
    label: localize(`config.menu.buttons.${button}`),
  }));

/**
 * Get the options for the menu style.
 * @returns The menu style options.
 */
export const getMenuStyleOptions = (): HASelectSelectorOption[] => [
  { value: 'none', label: localize('config.menu.styles.none') },
  { value: 'hidden', label: localize('config.menu.styles.hidden') },
  { value: 'overlay', label: localize('config.menu.styles.overlay') },
  { value: 'hover', label: localize('config.menu.styles.hover') },
  { value: 'hover-card', label: localize('config.menu.styles.hover-card') },
  { value: 'outside', label: localize('config.menu.styles.outside') },
];

/**
 * Get the options for the menu position.
 * @returns The menu position options.
 */
export const getMenuPositionOptions = (): HASelectSelectorOption[] => [
  { value: 'left', label: localize('config.menu.positions.left') },
  { value: 'right', label: localize('config.menu.positions.right') },
  { value: 'top', label: localize('config.menu.positions.top') },
  { value: 'bottom', label: localize('config.menu.positions.bottom') },
];

// The microphone button alone carries a `type` (momentary vs toggle).
const getMicrophoneTypeSchema = (): HAFormSchema => ({
  name: 'type',
  label: localize('config.menu.buttons.type'),
  selector: createSelectSelector([
    { value: 'momentary', label: localize('config.menu.buttons.types.momentary') },
    { value: 'toggle', label: localize('config.menu.buttons.types.toggle') },
  ]),
});

const getMenuButtonSchema = (
  button: string,
  extraSchema: HAFormSchema[] = [],
): HAFormExpandableSchema => ({
  name: button,
  type: 'expandable',
  title: localize(`config.menu.buttons.${button}`),
  icon: 'mdi:gesture-tap-button',
  schema: [
    {
      name: 'enabled',
      label: localize('config.menu.buttons.enabled'),
      selector: { boolean: {} },
    },
    {
      name: 'alignment',
      label: localize('config.menu.buttons.alignment'),
      selector: createSelectSelector([
        {
          value: 'matching',
          label: localize('config.menu.buttons.alignments.matching'),
        },
        {
          value: 'opposing',
          label: localize('config.menu.buttons.alignments.opposing'),
        },
      ]),
    },
    {
      name: 'permanent',
      label: localize('config.menu.buttons.permanent'),
      selector: { boolean: {} },
    },
    {
      name: 'priority',
      label: localize('config.menu.buttons.priority'),
      selector: createNumberSelector({ max: MENU_PRIORITY_MAX }),
    },
    {
      name: 'icon',
      label: localize('config.menu.buttons.icon'),
      selector: { icon: {} },
    },
    {
      name: 'state_color',
      label: localize('config.menu.buttons.state_color'),
      selector: { boolean: {} },
    },
    {
      name: 'inert',
      label: localize('config.menu.buttons.inert'),
      selector: { boolean: {} },
    },
    ...extraSchema,
  ],
});

/**
 * Get the forms for the menu section.
 * @returns The section forms.
 */
export const getMenuSectionForms = (): EditorForm[] => [
  {
    basePath: ['menu'],
    schema: [
      {
        name: 'style',
        selector: createSelectSelector(getMenuStyleOptions()),
      },
      {
        name: 'position',
        selector: createSelectSelector(getMenuPositionOptions()),
      },
      {
        name: 'alignment',
        selector: createSelectSelector([
          { value: 'left', label: localize('config.menu.alignments.left') },
          { value: 'right', label: localize('config.menu.alignments.right') },
          { value: 'top', label: localize('config.menu.alignments.top') },
          { value: 'bottom', label: localize('config.menu.alignments.bottom') },
        ]),
      },
      {
        name: 'auto_hide',
        selector: createSelectSelector(
          [
            {
              value: 'call',
              label: localize('config.common.auto_hide_conditions.call'),
            },
            {
              value: 'casting',
              label: localize('config.common.auto_hide_conditions.casting'),
            },
          ],
          { multiple: true },
        ),
      },
      {
        name: 'button_size',
        selector: createNumberSelector({ min: BUTTON_SIZE_MIN }),
      },
    ],
  },
  {
    basePath: ['menu', 'buttons'],
    schema: MENU_BUTTONS.map((button) =>
      button === 'microphone'
        ? getMenuButtonSchema(button, [getMicrophoneTypeSchema()])
        : getMenuButtonSchema(button),
    ),
  },
];
