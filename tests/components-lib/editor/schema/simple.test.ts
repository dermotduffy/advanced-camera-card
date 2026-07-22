import { assert, describe, expect, it } from 'vitest';

import {
  applyConfigChanges,
  computeConfigChanges,
  computeDisplayedData,
} from '../../../../src/components-lib/editor/form-data';
import {
  getSimpleMenuForms,
  getSimpleTopLevelForms,
} from '../../../../src/components-lib/editor/schema/simple';
import {
  findBinding,
  isComputedFieldBinding,
} from '../../../../src/components-lib/editor/types';
import { copyConfig, getConfigValue } from '../../../../src/config/management';
import { setProfiles } from '../../../../src/config/profiles/set-profiles';
import { menuConfigDefault } from '../../../../src/config/schema/menu';
import type { ProfileType } from '../../../../src/config/schema/profiles';
import { configDefaults } from '../../../../src/config/schema/types';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';

const [MENU_FORM] = getSimpleMenuForms();
const [TOP_LEVEL_FORM] = getSimpleTopLevelForms();

// The paths the buttons field says it stands for, taken from the field itself
// rather than from a walk of the form, so that the two can be compared.
const getMenuButtonsConfigPaths = () => {
  const binding = findBinding(MENU_FORM, ['menu_buttons']);
  assert(binding && isComputedFieldBinding(binding));
  return binding.configPaths;
};

// The values a field shows when the configuration does not set it, built the
// way the editor builds them so that profiles are taken into account. The
// configuration given to `setProfiles` must be a valid one: it does not apply a
// profile over a configuration it cannot parse.
const createDefaults = (profiles: ProfileType[] = []): RawAdvancedCameraCardConfig => {
  const defaults = copyConfig(configDefaults);
  setProfiles(
    {
      type: 'custom:advanced-camera-card',
      cameras: [{ camera_entity: 'camera.office' }],
    },
    defaults,
    profiles,
  );
  return defaults;
};

const getMenuButtons = (
  config: RawAdvancedCameraCardConfig,
  defaults: RawAdvancedCameraCardConfig = createDefaults(),
): unknown =>
  getConfigValue(computeDisplayedData(MENU_FORM, config, defaults), 'menu_buttons');

// Edit the buttons as the form does: the form emits everything it displays,
// with the edited field changed.
const changeMenuButtons = (
  config: RawAdvancedCameraCardConfig,
  buttons: unknown,
  defaults: RawAdvancedCameraCardConfig = createDefaults(),
) => {
  const displayed = computeDisplayedData(MENU_FORM, config, defaults);
  return computeConfigChanges(
    MENU_FORM,
    displayed,
    { ...displayed, menu_buttons: buttons },
    config,
    defaults,
  );
};

describe('the simple editor forms', () => {
  it('should show the value of the configuration key a field is bound to', () => {
    expect(
      computeDisplayedData(
        MENU_FORM,
        { menu: { style: 'outside', position: 'left' } },
        createDefaults(),
      ),
    ).toMatchObject({ menu_style: 'outside', menu_position: 'left' });

    expect(
      computeDisplayedData(
        TOP_LEVEL_FORM,
        { view: { default: 'clips' } },
        createDefaults(),
      ),
    ).toMatchObject({ default_view: 'clips' });
  });

  it('should write an edit to the configuration key a field is bound to', () => {
    expect(
      computeConfigChanges(
        MENU_FORM,
        { menu_style: 'hidden' },
        { menu_style: 'outside' },
        {},
        createDefaults(),
      ),
    ).toEqual([{ path: ['menu', 'style'], type: 'set', value: 'outside' }]);

    expect(
      computeConfigChanges(
        TOP_LEVEL_FORM,
        { default_view: 'live' },
        { default_view: 'clips' },
        {},
        createDefaults(),
      ),
    ).toEqual([{ path: ['view', 'default'], type: 'set', value: 'clips' }]);
  });
});

describe('the menu buttons field', () => {
  it('should select the buttons the menu shows by default', () => {
    // `iris` is shown by default, `clips` is not.
    expect(getMenuButtons({})).toContain('iris');
    expect(getMenuButtons({})).not.toContain('clips');
  });

  it('should select buttons by what the configuration sets, not the defaults', () => {
    const buttons = getMenuButtons({
      menu: { buttons: { iris: { enabled: false }, clips: { enabled: true } } },
    });

    expect(buttons).not.toContain('iris');
    expect(buttons).toContain('clips');
  });

  it('should not select a button that a profile hides', () => {
    // The low performance profile hides `iris` and `timeline`.
    expect(getMenuButtons({}, createDefaults(['low-performance']))).not.toContain(
      'iris',
    );
  });

  it('should store false for a default-shown button that is turned off', () => {
    expect(changeMenuButtons({}, ['clips'])).toContainEqual({
      path: ['menu', 'buttons', 'iris', 'enabled'],
      type: 'set',
      value: false,
    });
  });

  it('should store true for a default-hidden button that is turned on', () => {
    expect(changeMenuButtons({}, ['clips'])).toContainEqual({
      path: ['menu', 'buttons', 'clips', 'enabled'],
      type: 'set',
      value: true,
    });
  });

  it('should remove the stored value of a button returned to its default', () => {
    const config = { menu: { buttons: { clips: { enabled: true } } } };

    expect(changeMenuButtons(config, [])).toContainEqual({
      path: ['menu', 'buttons', 'clips', 'enabled'],
      type: 'delete',
    });
  });

  it('should change nothing for the buttons that stay as they are', () => {
    // Only `clips` moves: everything else is already as asked for.
    const config = { menu: { buttons: { iris: { enabled: false } } } };
    const buttons = getMenuButtons(config);
    const wanted = Array.isArray(buttons) ? [...buttons, 'clips'] : ['clips'];

    expect(changeMenuButtons(config, wanted)).toEqual([
      { path: ['menu', 'buttons', 'clips', 'enabled'], type: 'set', value: true },
    ]);
  });

  it('should treat a value that is not a list of buttons as none selected', () => {
    expect(changeMenuButtons({}, undefined)).toContainEqual({
      path: ['menu', 'buttons', 'iris', 'enabled'],
      type: 'set',
      value: false,
    });
  });

  it('should stand for the enabled setting of every menu button the card has', () => {
    // Taken from the card's own menu defaults rather than from the editor, so
    // that a button the card gains and the editor does not is a failure.
    const expected = Object.keys(menuConfigDefault.buttons).map(
      (button) => `menu.buttons.${button}.enabled`,
    );

    expect(
      getMenuButtonsConfigPaths()
        .map((path) => path.join('.'))
        .sort(),
    ).toEqual(expected.sort());
  });

  it('should change only the configuration keys it stands for', () => {
    const declared = new Set(
      Object.keys(menuConfigDefault.buttons).map(
        (button) => `menu.buttons.${button}.enabled`,
      ),
    );
    const changes = changeMenuButtons({}, ['clips', 'iris']);

    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      expect(declared).toContain(change.path.join('.'));
    }
  });

  it('should leave the rest of the configuration as it was', () => {
    const config = {
      cameras: [{ camera_entity: 'camera.office' }],
      menu: {
        style: 'outside',
        buttons: { iris: { enabled: false, priority: 7, icon: 'mdi:cow' } },
      },
      live: { preload: true },
      timeline: { window_seconds: 7200 },
    };

    // Turn `iris` back on, which returns it to its default, and `clips` on,
    // leaving every other button as it is.
    const shown = getMenuButtons(config);
    assert(Array.isArray(shown));
    const edited = applyConfigChanges(
      config,
      changeMenuButtons(config, [...shown, 'iris', 'clips']),
    );
    assert(edited);

    expect(edited).toEqual({
      cameras: [{ camera_entity: 'camera.office' }],
      menu: {
        style: 'outside',
        buttons: {
          // The button's other settings survive its `enabled` being removed.
          iris: { priority: 7, icon: 'mdi:cow' },
          clips: { enabled: true },
        },
      },
      live: { preload: true },
      timeline: { window_seconds: 7200 },
    });
  });
});
