import { assert, describe, expect, it } from 'vitest';

import {
  applyConfigChanges,
  computeConfigChanges,
  computeDisplayedData,
} from '../../../src/components-lib/editor/form-data';
import {
  deriveEditorMode,
  getEditorMode,
} from '../../../src/components-lib/editor/mode';
import { getSimpleMenuForms } from '../../../src/components-lib/editor/schema/simple';
import { getConfigValue } from '../../../src/config/management';
import { configDefaults } from '../../../src/config/schema/types';

// The card type is in every configuration Home Assistant hands the editor.
const createConfig = (config: Record<string, unknown> = {}) => ({
  type: 'custom:advanced-camera-card',
  ...config,
});

describe('deriveEditorMode', () => {
  it('should choose the simple editor for a configuration that sets nothing', () => {
    expect(deriveEditorMode(createConfig())).toBe('simple');
  });

  it('should choose the simple editor for the settings it shows', () => {
    expect(
      deriveEditorMode(
        createConfig({
          cameras: [
            { camera_entity: 'camera.office', live_provider: 'go2rtc' },
            { camera_entity: 'camera.kitchen', title: 'Kitchen', icon: 'mdi:cctv' },
          ],
          menu: {
            style: 'outside',
            position: 'left',
            buttons: { clips: { enabled: true } },
          },
          dimensions: { aspect_ratio_mode: 'static', aspect_ratio: '16:9' },
          view: { default: 'clips' },
          profiles: ['casting'],
        }),
      ),
    ).toBe('simple');
  });

  it('should choose the full editor for a setting the simple editor does not show', () => {
    expect(deriveEditorMode(createConfig({ view: { dim: true } }))).toBe('full');
  });

  it('should choose the full editor for a menu button property it does not show', () => {
    expect(
      deriveEditorMode(createConfig({ menu: { buttons: { clips: { priority: 5 } } } })),
    ).toBe('full');
  });

  it.each([
    [{ live: { preload: true } }],
    [{ timeline: { window_seconds: 7200 } }],
    [{ folders: [{ type: 'ha' }] }],
    [{ cameras: [{ camera_entity: 'camera.office', engine: 'frigate' }] }],
  ])('should choose the full editor for %j', (config) => {
    expect(deriveEditorMode(createConfig(config))).toBe('full');
  });

  it.each([
    // Not a setting of the card at all.
    [{ fake: true }],

    // Settings the full editor does not show either, so sending the user there
    // would show them nothing more.
    [{ debug: { logging: true } }],
    [{ card_mod: { style: 'body {}' } }],
    [{ cameras_global: { live_provider: 'go2rtc' } }],
    [{ elements: [{ type: 'custom:foo' }] }],
    [{ automations: [{ conditions: [{ condition: 'fullscreen' }] }] }],
    [{ overrides: [{ merge: { menu: { style: 'none' } } }] }],
    [{ cameras: [{ camera_entity: 'camera.office', ptz: { presets: {} } }] }],
  ])('should choose the simple editor for %j', (config) => {
    expect(deriveEditorMode(createConfig(config))).toBe('simple');
  });

  it('should disregard a section that sets nothing', () => {
    expect(deriveEditorMode(createConfig({ live: {}, folders: [{}] }))).toBe('simple');
  });

  it('should disregard the editor mode itself', () => {
    expect(deriveEditorMode(createConfig({ editor: { mode: 'full' } }))).toBe('simple');
  });
});

describe('getEditorMode', () => {
  it.each([['simple' as const], ['full' as const]])(
    'should use the configured %s mode',
    (mode) => {
      // A configuration the derivation would send to the other editor, so that
      // the configured mode is what the result comes from.
      const config = createConfig({
        editor: { mode },
        ...(mode === 'simple' ? { view: { dim: true } } : {}),
      });
      expect(getEditorMode(config)).toBe(mode);
    },
  );

  it('should derive the mode when the configuration does not say', () => {
    expect(getEditorMode(createConfig())).toBe('simple');
    expect(getEditorMode(createConfig({ view: { dim: true } }))).toBe('full');
  });

  it('should derive the mode when the configured one is not an editor', () => {
    expect(getEditorMode(createConfig({ editor: { mode: 'simpel' } }))).toBe('simple');
  });

  it('should still choose the simple editor after an edit made in it', () => {
    const config = createConfig({ cameras: [{ camera_entity: 'camera.office' }] });
    expect(getEditorMode(config)).toBe('simple');

    // A menu style chosen in the simple editor, written the way the editor
    // writes it.
    const [form] = getSimpleMenuForms();
    const displayed = computeDisplayedData(form, config, configDefaults);
    const edited = applyConfigChanges(
      config,
      computeConfigChanges(
        form,
        displayed,
        { ...displayed, menu_style: 'outside' },
        config,
        configDefaults,
      ),
    );
    assert(edited);

    expect(getConfigValue(edited, 'menu.style')).toBe('outside');
    expect(getEditorMode(edited)).toBe('simple');
  });
});
