import { CONF_CAMERAS } from '../../../config/const';
import { getConfigValue } from '../../../config/management';
import type { RawAdvancedCameraCardConfig } from '../../../config/types';
import { localize } from '../../../localize/localize';
import type { ConfigChange, ConfigPath, EditorForm, FieldBinding } from '../types';
import { getCameraSimpleFields } from './cameras';
import { createSelectSelector } from './common/selectors';
import { getAspectRatioModeOptions } from './dimensions';
import {
  getMenuButtonOptions,
  getMenuPositionOptions,
  getMenuStyleOptions,
  MENU_BUTTONS,
} from './menu';
import { getProfilesField } from './profiles';
import { getViewModeOptions } from './view';

const getMenuButtonEnabledPath = (button: string): ConfigPath => [
  'menu',
  'buttons',
  button,
  'enabled',
];

// Whether a button is shown with the configuration as it stands: what the
// configuration says, or what the (profile-adjusted) defaults say for a button
// the configuration does not mention.
const isMenuButtonEnabled = (
  config: RawAdvancedCameraCardConfig,
  defaults: RawAdvancedCameraCardConfig,
  button: string,
): boolean => {
  const path = getMenuButtonEnabledPath(button);
  const configured = getConfigValue(config, path);
  return typeof configured === 'boolean'
    ? configured
    : getConfigValue(defaults, path) === true;
};

// The single control for which buttons the menu shows, standing for one
// `enabled` key per button. Roughly half the buttons are shown by default, so a
// button the user turns off has to be written out as `false` rather than having
// its key removed.
const getMenuButtonsBinding = (): FieldBinding => ({
  formPath: ['menu_buttons'],
  configPaths: MENU_BUTTONS.map(getMenuButtonEnabledPath),
  read: (config, defaults) =>
    MENU_BUTTONS.filter((button) => isMenuButtonEnabled(config, defaults, button)),
  write: (value, config, defaults) => {
    const selected = Array.isArray(value) ? value : [];
    const changes: ConfigChange[] = [];

    for (const button of MENU_BUTTONS) {
      const wanted = selected.includes(button);
      if (wanted === isMenuButtonEnabled(config, defaults, button)) {
        continue;
      }
      const path = getMenuButtonEnabledPath(button);
      changes.push(
        wanted === (getConfigValue(defaults, path) === true)
          ? { path, type: 'delete' }
          : { path, type: 'set', value: wanted },
      );
    }
    return changes;
  },
});

// The simple editor's fields are gathered from across the configuration, so
// each is named for what it means where it is shown and bound to where the
// setting actually lives.

export const getSimpleMenuForms = (): EditorForm[] => [
  {
    basePath: [],
    schema: [
      {
        name: 'menu_style',
        selector: createSelectSelector(getMenuStyleOptions()),
      },
      {
        name: 'menu_position',
        selector: createSelectSelector(getMenuPositionOptions()),
      },
      {
        name: 'menu_buttons',
        label: localize('config.menu.buttons.editor_label'),
        selector: createSelectSelector(getMenuButtonOptions(), { multiple: true }),
      },
    ],
    bindings: [
      { formPath: ['menu_style'], configPath: ['menu', 'style'] },
      { formPath: ['menu_position'], configPath: ['menu', 'position'] },
      getMenuButtonsBinding(),
    ],
  },
];

/**
 * Get the settings the simple editor shows above everything else. They are
 * single controls with nothing behind them, so they are shown as they are
 * rather than in a section that has to be opened.
 * @returns The top level forms.
 */
export const getSimpleTopLevelForms = (): EditorForm[] => [
  {
    basePath: [],
    schema: [
      {
        name: 'default_view',
        selector: createSelectSelector(getViewModeOptions()),
      },

      // The ratio only means anything alongside the mode that uses it, so the
      // two are shown together.
      {
        type: 'grid',
        schema: [
          {
            name: 'aspect_ratio_mode',
            selector: createSelectSelector(getAspectRatioModeOptions()),
          },
          {
            name: 'aspect_ratio',
            selector: { text: {} },
          },
        ],
      },
      getProfilesField(),
    ],
    bindings: [
      { formPath: ['default_view'], configPath: ['view', 'default'] },
      {
        formPath: ['aspect_ratio_mode'],
        configPath: ['dimensions', 'aspect_ratio_mode'],
      },
      { formPath: ['aspect_ratio'], configPath: ['dimensions', 'aspect_ratio'] },
    ],
  },
];

/**
 * Get the form for one camera in the simple editor: what the camera is and what
 * it is called, without the settings a working camera does not need.
 * @param index The camera's position in the configuration.
 * @returns The camera's forms.
 */
export const getSimpleCameraForms = (index: number): EditorForm[] => [
  {
    basePath: [CONF_CAMERAS, index],
    schema: getCameraSimpleFields(),
  },
];
