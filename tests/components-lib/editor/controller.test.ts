import type { LitElement } from 'lit';
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { EditorController } from '../../../src/components-lib/editor/controller';
import { getConfigValue } from '../../../src/config/management';
import { configDefaults } from '../../../src/config/schema/types';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { sideLoadHomeAssistantElements } from '../../../src/ha/side-load-ha-elements';
import { localize } from '../../../src/localize/localize';
import { isRecord } from '../../../src/utils/basic';
import { createHASS, createLitElement, flushPromises } from '../../test-utils';

vi.mock('../../../src/ha/side-load-ha-elements');

interface ControllerHarness {
  controller: EditorController;
  host: LitElement;
  configListener: Mock;
}

const createController = (): ControllerHarness => {
  const host = createLitElement();
  const controller = new EditorController(host);
  const configListener = vi.fn();
  host.addEventListener('config-changed', configListener);

  return { controller, host, configListener };
};

const getLastConfig = (configListener: Mock): RawAdvancedCameraCardConfig => {
  const event = configListener.mock.lastCall?.[0];
  assert(event instanceof CustomEvent);
  const config: unknown = event.detail.config;
  assert(isRecord(config));

  return config;
};

// A configuration the upgrade rules can rewrite (`service_data` was renamed to
// `data`).
const createUpgradeableConfig = (): RawAdvancedCameraCardConfig => ({
  cameras: [{ camera_entity: 'camera.office' }],
  elements: [
    {
      type: 'icon',
      icon: 'mdi:cow',
      tap_action: {
        action: 'call-service',
        service: 'notify.persistent_notification',
        service_data: { message: 'Hello' },
      },
    },
  ],
});

// @vitest-environment jsdom
describe('EditorController', () => {
  beforeEach(() => {
    vi.mocked(sideLoadHomeAssistantElements).mockReset();
    vi.mocked(sideLoadHomeAssistantElements).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register with the host', () => {
    const host = createLitElement();
    const controller = new EditorController(host);
    expect(host.addController).toHaveBeenCalledWith(controller);
    controller.hostConnected();
  });

  describe('should initialize', () => {
    it('should side-load Home Assistant elements only once', async () => {
      const { controller } = createController();

      controller.initialize();
      await flushPromises();
      controller.initialize();

      expect(sideLoadHomeAssistantElements).toHaveBeenCalledTimes(1);
    });

    it('should log and retry after a failed side-load', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);
      vi.mocked(sideLoadHomeAssistantElements).mockRejectedValue(new Error('fail'));
      const { controller } = createController();

      controller.initialize();
      await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('fail'));

      controller.initialize();
      expect(sideLoadHomeAssistantElements).toHaveBeenCalledTimes(2);
    });
  });

  describe('should set the configuration', () => {
    it('should store the configuration and request an update', () => {
      const { controller, host } = createController();
      expect(controller.getConfig()).toBeNull();

      const config = { cameras: [] };
      controller.setConfig(config);

      expect(controller.getConfig()).toBe(config);
      expect(host.requestUpdate).toHaveBeenCalled();
    });

    it('should detect an upgradeable configuration', () => {
      const { controller } = createController();
      expect(controller.isConfigUpgradeable()).toBeFalsy();

      controller.setConfig(createUpgradeableConfig());
      expect(controller.isConfigUpgradeable()).toBeTruthy();

      controller.setConfig({ cameras: [] });
      expect(controller.isConfigUpgradeable()).toBeFalsy();
    });

    it('should apply profile defaults', () => {
      const { controller } = createController();
      controller.setConfig({ cameras: [], profiles: ['scrubbing'] });

      expect(
        getConfigValue(
          controller.getFormsInput().defaults,
          'media_viewer.controls.timeline.style',
        ),
      ).toBe('ribbon');
    });

    it('should reset profile defaults when profiles become invalid', () => {
      const { controller } = createController();
      controller.setConfig({ cameras: [], profiles: ['scrubbing'] });
      controller.setConfig({ cameras: [], profiles: 42 });

      expect(
        getConfigValue(
          controller.getFormsInput().defaults,
          'media_viewer.controls.timeline.style',
        ),
      ).toBe(configDefaults.media_viewer.controls.timeline.style);
    });

    it.each([
      [{ cameras: [] }, []],
      [{ cameras: [], profiles: ['low-performance'] }, ['warning']],
      [{ cameras: [], profiles: 42 }, []],
      [{ cameras: [], overrides: [] }, []],
      [{ cameras: [], overrides: [{}] }, ['info']],
    ])('should compute the notices for %j', (config, noticeTypes) => {
      const { controller } = createController();
      controller.setConfig(config);
      expect(controller.getNotices().map((notice) => notice.type)).toEqual(noticeTypes);
    });

    it('should have notices for the low-performance profile and overrides', () => {
      const { controller } = createController();
      controller.setConfig({
        cameras: [],
        profiles: ['low-performance'],
        overrides: [{}],
      });
      expect(controller.getNotices()).toEqual([
        { type: 'warning', message: localize('config.performance.warning') },
        { type: 'info', message: localize('config.overrides.info') },
      ]);
    });

    it('should have no notices without a configuration', () => {
      const { controller } = createController();
      expect(controller.getNotices()).toEqual([]);
    });

    it('should say when the simple editor does not have full coverage', () => {
      const { controller } = createController();
      controller.setConfig({
        cameras: [{ camera_entity: 'camera.office' }],
        view: { dim: true },
        editor: { mode: 'simple' },
      });

      expect(controller.getNotices()).toEqual([
        { type: 'info', message: localize('editor.simple_coverage') },
      ]);
    });

    it.each([
      [
        'the simple editor shows everything set',
        { cameras: [{ camera_entity: 'camera.office' }], editor: { mode: 'simple' } },
      ],
      [
        'the full editor is in use',
        { cameras: [{ camera_entity: 'camera.office' }], view: { dim: true } },
      ],
    ])('should have no coverage notice when %s', (_case, config) => {
      const { controller } = createController();
      controller.setConfig(config);
      expect(controller.getNotices()).toEqual([]);
    });

    it.each([
      [{ cameras: [{ camera_entity: 'camera.office' }] }, 'simple' as const],
      [{ cameras: [], view: { dim: true } }, 'full' as const],
      [{ cameras: [], editor: { mode: 'full' } }, 'full' as const],
    ])('should choose the editor for %j', (config, mode) => {
      const { controller } = createController();
      controller.setConfig(config);
      expect(controller.getEditorMode()).toBe(mode);
    });
  });

  describe('should describe what a section needs', () => {
    it('should offer an empty configuration before one is set', () => {
      const { controller } = createController();
      expect(controller.getFormsInput().config).toEqual({});
    });

    it('should offer the configuration and its defaults', () => {
      const { controller } = createController();
      const config = { cameras: [] };
      controller.setConfig(config);

      const input = controller.getFormsInput();
      expect(input.config).toBe(config);
      expect(input.defaults).toBe(controller.getDefaults());
    });

    it('should offer the cameras and folders its selectors need', () => {
      const { controller } = createController();
      controller.setConfig({
        cameras: [{ id: 'one' }, { camera_entity: 'camera.office' }],
        folders: [{ id: 'recordings', title: 'Recordings' }],
      });

      const { options } = controller.getFormsInput();
      expect(options.cameras).toEqual([
        { value: 'one', label: 'one' },
        { value: 'camera.office', label: 'Camera #1' },
      ]);
      expect(options.folders).toEqual([{ value: 'recordings', label: 'Recordings' }]);
    });

    it('should report a list holding entries that are not objects', () => {
      const { controller } = createController();
      controller.setConfig({ cameras: [{ id: 'one' }, 'junk'], folders: 'junk' });

      const { options } = controller.getFormsInput();
      expect(options.cameras).toHaveLength(2);
      expect(options.folders).toEqual([]);
    });
  });

  describe('should set HASS', () => {
    it('should offer the HomeAssistant object it was given', () => {
      const { controller } = createController();
      const hass = createHASS();

      controller.setHASS(hass);

      expect(controller.getHASS()).toBe(hass);
    });
  });

  describe('should upgrade', () => {
    it('should upgrade an upgradeable configuration', () => {
      const { controller, configListener } = createController();
      controller.setConfig(createUpgradeableConfig());

      controller.upgrade();

      const config = getLastConfig(configListener);
      expect(getConfigValue(config, 'elements.0.tap_action.data')).toEqual({
        message: 'Hello',
      });
      expect(controller.isConfigUpgradeable()).toBeFalsy();
    });

    it('should do nothing without a configuration', () => {
      const { controller, configListener } = createController();

      controller.upgrade();

      expect(configListener).not.toHaveBeenCalled();
    });

    it('should not fire for a configuration that needs no upgrade', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ cameras: [] });

      controller.upgrade();

      expect(configListener).not.toHaveBeenCalled();
    });
  });

  describe('should carry out an intent', () => {
    it('should apply changes', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ cameras: [] });

      controller.applyIntent({
        type: 'changes',
        changes: [{ path: ['menu', 'style'], type: 'set', value: 'outside' }],
      });

      expect(getConfigValue(getLastConfig(configListener), 'menu.style')).toBe(
        'outside',
      );
    });

    it('should not fire when the changes leave the configuration unmodified', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ menu: { style: 'outside' } });

      controller.applyIntent({
        type: 'changes',
        changes: [{ path: ['menu', 'style'], type: 'set', value: 'outside' }],
      });

      expect(configListener).not.toHaveBeenCalled();
    });

    it('should add an item to a list', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ cameras: [{ id: 'one' }] });

      controller.applyIntent({
        type: 'list-add',
        path: ['cameras'],
        item: { id: 'two' },
      });

      expect(getConfigValue(getLastConfig(configListener), 'cameras')).toEqual([
        { id: 'one' },
        { id: 'two' },
      ]);
    });

    it('should move an item within a list', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ cameras: [{ id: 'one' }, { id: 'two' }] });

      controller.applyIntent({ type: 'list-move', path: ['cameras'], from: 0, to: 1 });

      expect(getConfigValue(getLastConfig(configListener), 'cameras')).toEqual([
        { id: 'two' },
        { id: 'one' },
      ]);
    });

    it('should delete an item from a list', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ cameras: [{ id: 'one' }, { id: 'two' }] });

      controller.applyIntent({ type: 'list-delete', path: ['cameras'], index: 0 });

      expect(getConfigValue(getLastConfig(configListener), 'cameras')).toEqual([
        { id: 'two' },
      ]);
    });

    it('should not fire for a list change that cannot be made', () => {
      const { controller, configListener } = createController();
      controller.setConfig({ cameras: [{ id: 'one' }] });

      controller.applyIntent({ type: 'list-delete', path: ['cameras'], index: 5 });

      expect(configListener).not.toHaveBeenCalled();
    });

    it.each([
      [{ type: 'changes' as const, changes: [] }],
      [{ type: 'list-add' as const, path: ['cameras'], item: {} }],
      [{ type: 'list-move' as const, path: ['cameras'], from: 0, to: 1 }],
      [{ type: 'list-delete' as const, path: ['cameras'], index: 0 }],
    ])('should do nothing for %j without a configuration', (intent) => {
      const { controller, configListener } = createController();

      controller.applyIntent(intent);

      expect(configListener).not.toHaveBeenCalled();
    });
  });
});
