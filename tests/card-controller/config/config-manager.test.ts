import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { AutomationsManager } from '../../../src/card-controller/automations-manager';
import { ConfigManager } from '../../../src/card-controller/config/config-manager';
import { InitializationAspect } from '../../../src/card-controller/initialization-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { Automation } from '../../../src/config/schema/automations';
import { AdvancedCameraCardCondition } from '../../../src/config/schema/conditions/types';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createGeneralAction } from '../../../src/utils/action';
import { createCardAPI, createConfig, flushPromises } from '../../test-utils';

/**
 * Create a ConfigManager test setup with real AutomationsManager and ConditionStateManager.
 * Includes spies for automation manager methods to track calls in tests.
 */
function createConfigManagerTestSetup(options?: {
  hasHASS?: boolean;
  isInitializedMandatory?: boolean;
}) {
  const api = createCardAPI();
  const stateManager = new ConditionStateManager();
  vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

  const automationsManager = new AutomationsManager(api);
  vi.mocked(api.getAutomationsManager).mockReturnValue(automationsManager);
  vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(options?.hasHASS ?? true);
  vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
    options?.isInitializedMandatory ?? true,
  );

  const manager = new ConfigManager(api);
  vi.mocked(api.getConfigManager).mockReturnValue(manager);

  const addAutomationsSpy = vi.spyOn(automationsManager, 'addAutomations');
  const deleteAutomationsSpy = vi.spyOn(automationsManager, 'deleteAutomations');

  return {
    api,
    manager,
    stateManager,
    automationsManager,
    addAutomationsSpy,
    deleteAutomationsSpy,
  };
}

// ============================================================================
// Test Constants - Centralized test data to avoid magic numbers/strings
// ============================================================================

/** Test camera entities - Primary is used for standard tests */
const TEST_CAMERAS = {
  OFFICE: { camera_entity: 'camera.office' },
  KITCHEN: { camera_entity: 'camera.kitchen' },
} as const;

/** Override conditions commonly used in tests */
const TEST_CONDITIONS = {
  FULLSCREEN_ON: { condition: 'fullscreen' as const, fullscreen: true },
  FULLSCREEN_OFF: { condition: 'fullscreen' as const, fullscreen: false },
} as const;

/** Profile settings for testing */
const TEST_PROFILES = {
  LOW_PERFORMANCE: 'low-performance' as const,
} as const;

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should handle error when', () => {
    it('no input', () => {
      const manager = new ConfigManager(createCardAPI());
      expect(() => manager.setConfig()).toThrowError(/Invalid configuration/);
    });

    it('invalid configuration', () => {
      const spy = vi.spyOn(advancedCameraCardConfigSchema, 'safeParse').mockReturnValue({
        success: false,
        error: new ZodError([]),
      });

      const manager = new ConfigManager(createCardAPI());
      expect(() => manager.setConfig({})).toThrowError(
        'Invalid configuration: No location hint available (bad or missing type?)',
      );

      spy.mockRestore();
    });

    it('invalid configuration with hint', () => {
      const manager = new ConfigManager(createCardAPI());
      expect(() => manager.setConfig({})).toThrowError(
        'Invalid configuration: [\n "type"\n]',
      );
    });

    it('upgradeable', () => {
      const manager = new ConfigManager(createCardAPI());
      expect(() =>
        manager.setConfig({
          // This key needs to be upgradeable in `management.ts` .
          type: 'custom:frigate-card',
          cameras: 'WILL_NOT_PARSE',
        }),
      ).toThrowError(
        'An automated card configuration upgrade is ' +
          'available, please visit the visual card editor. ' +
          'Invalid configuration: [\n "cameras"\n]',
      );
    });
  });

  it('should have initial state', () => {
    const manager = new ConfigManager(createCardAPI());

    expect(manager.getConfig()).toBeNull();
    expect(manager.getNonOverriddenConfig()).toBeNull();
    expect(manager.getRawConfig()).toBeNull();
  });

  it('should successfully parse basic config', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:advanced-camera-card',
      cameras: [TEST_CAMERAS.OFFICE],
    };

    manager.setConfig(config);

    expect(manager.hasConfig()).toBeTruthy();
    expect(manager.getRawConfig()).toBe(config);

    // Verify at least the camera is set.
    expect(manager.getConfig()?.cameras[0].camera_entity).toBe('camera.office');

    // Verify at least one default was set.
    expect(manager.getConfig()?.menu.alignment).toBe('left');

    // Verify appropriate API calls are made.
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      view: undefined,
      displayMode: undefined,
      camera: undefined,
    });
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getViewManager().reset).toBeCalled();
    expect(api.getMessageManager().reset).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).toBeCalled();
    expect(api.getStyleManager().updateFromConfig).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should apply profiles', () => {
    const manager = new ConfigManager(createCardAPI());
    const config = {
      type: 'custom:advanced-camera-card',
      cameras: [TEST_CAMERAS.OFFICE],
      profiles: [TEST_PROFILES.LOW_PERFORMANCE],
    };

    manager.setConfig(config);

    // Verify at least one low performance default.
    expect(manager.getConfig()?.live.draggable).toBeFalsy();
  });

  it('should skip identical configs', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:advanced-camera-card',
      cameras: [TEST_CAMERAS.OFFICE],
    };

    manager.setConfig(config);
    expect(api.getViewManager().reset).toBeCalled();

    vi.mocked(api.getViewManager().reset).mockClear();

    manager.setConfig(config);
    expect(api.getViewManager().reset).not.toBeCalled();
  });

  it('should get card wide config', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:advanced-camera-card',
      cameras: [TEST_CAMERAS.OFFICE],
      debug: {
        logging: true,
      },
      performance: {
        style: {
          box_shadow: false,
        },
      },
    };

    manager.setConfig(config);

    expect(manager.getCardWideConfig()).toEqual({
      debug: {
        logging: true,
      },
      performance: {
        features: {
          animated_progress_indicator: true,
          card_loading_indicator: true,
          card_loading_effects: true,
          media_chunk_size: 50,
        },
        style: {
          border_radius: true,
          box_shadow: false,
        },
      },
    });
  });

  describe('should override', () => {
    it('should ignore overrides with same config', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ConfigManager(api);
      const cameras = [TEST_CAMERAS.OFFICE];
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: cameras,
        overrides: [
          {
            conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            set: {
              // Override with the same.
              cameras: cameras,
            },
          },
        ],
      };

      manager.setConfig(config);

      expect(api.getStyleManager().updateFromConfig).toBeCalledTimes(1);

      stateManager.setState({ fullscreen: true });

      expect(api.getStyleManager().updateFromConfig).toBeCalledTimes(1);
    });

    it('should honor override', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ConfigManager(api);
      const config = createConfig({
        menu: {
          style: 'hidden',
        },
        overrides: [
          {
            conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            set: { 'menu.style': 'none' },
          },
        ],
      });

      manager.setConfig(config);
      expect(manager.getConfig()?.menu?.style).toBe('hidden');

      stateManager.setState({ fullscreen: true });
      expect(manager.getConfig()?.menu?.style).toBe('none');
      expect(manager.getConfig()).not.toEqual(manager.getNonOverriddenConfig());
    });

    it('should set error on invalid override', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ConfigManager(api);
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [TEST_CAMERAS.OFFICE],
        overrides: [
          {
            conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            delete: ['type'],
          },
        ],
      };

      manager.setConfig(config);
      expect(manager.getConfig()).not.toBeNull();

      stateManager.setState({ fullscreen: true });
      expect(manager.getConfig()).not.toBeNull();
      expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(
        expect.objectContaining({ message: 'Invalid override configuration' }),
      );
    });

    describe('should uninitialize on override', () => {
      it('cameras', () => {
        const api = createCardAPI();
        const stateManager = new ConditionStateManager();
        vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

        const manager = new ConfigManager(api);
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [TEST_CAMERAS.OFFICE],
          overrides: [
            {
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
              set: {
                cameras: [TEST_CAMERAS.KITCHEN],
              },
            },
          ],
        };

        manager.setConfig(config);

        expect(api.getInitializationManager().uninitialize).not.toHaveBeenCalledWith(
          InitializationAspect.CAMERAS,
        );

        stateManager.setState({ fullscreen: true });

        expect(api.getInitializationManager().uninitialize).toHaveBeenCalledWith(
          InitializationAspect.CAMERAS,
        );
      });

      it('cameras_global', () => {
        const api = createCardAPI();
        const stateManager = new ConditionStateManager();
        vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

        const manager = new ConfigManager(api);
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [TEST_CAMERAS.OFFICE],
          overrides: [
            {
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
              set: {
                cameras_global: { live_provider: 'jsmpeg' },
              },
            },
          ],
        };

        manager.setConfig(config);

        expect(api.getInitializationManager().uninitialize).not.toHaveBeenCalledWith(
          InitializationAspect.CAMERAS,
        );

        stateManager.setState({ fullscreen: true });

        expect(api.getInitializationManager().uninitialize).toHaveBeenCalledWith(
          InitializationAspect.CAMERAS,
        );
      });

      it('live.microphone.always_connected', () => {
        const api = createCardAPI();
        const stateManager = new ConditionStateManager();
        vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

        const manager = new ConfigManager(api);
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [TEST_CAMERAS.OFFICE],
          overrides: [
            {
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
              set: {
                'live.microphone.always_connected': true,
              },
            },
          ],
        };

        manager.setConfig(config);

        expect(api.getInitializationManager().uninitialize).not.toHaveBeenCalledWith(
          InitializationAspect.MICROPHONE_CONNECT,
        );

        stateManager.setState({ fullscreen: true });

        expect(api.getInitializationManager().uninitialize).toHaveBeenCalledWith(
          InitializationAspect.MICROPHONE_CONNECT,
        );
      });
    });

    describe('should initialize on override', () => {
      it('should initialize background items', async () => {
        const api = createCardAPI();
        const stateManager = new ConditionStateManager();
        const listener = vi.fn();
        stateManager.addListener(listener);
        vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

        const manager = new ConfigManager(api);
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [TEST_CAMERAS.OFFICE],
          overrides: [
            {
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
              set: {
                cameras: [TEST_CAMERAS.KITCHEN],
              },
            },
          ],
        };

        manager.setConfig(config);

        await flushPromises();

        expect(api.getDefaultManager().initializeIfNecessary).toBeCalledTimes(1);
        expect(api.getMediaPlayerManager().initializeIfNecessary).toBeCalledTimes(1);
        expect(listener).not.toBeCalledWith(
          expect.objectContaining({ change: { config: expect.anything() } }),
        );

        vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
          true,
        );
        stateManager.setState({ fullscreen: true });

        await flushPromises();

        expect(api.getDefaultManager().initializeIfNecessary).toBeCalledTimes(2);
        expect(api.getMediaPlayerManager().initializeIfNecessary).toBeCalledTimes(2);

        // Should set the config condition state.
        expect(listener).toBeCalledWith(
          expect.objectContaining({ change: { config: expect.anything() } }),
        );
      });
    });

    describe('loaders should re-run when overrides change', () => {
      it('should re-run keyboard-shortcuts loader when overrides change', async () => {
        const { manager, stateManager, addAutomationsSpy } =
          createConfigManagerTestSetup();

        const config = createConfig({
          view: {
            keyboard_shortcuts: {
              enabled: true,
              ptz_home: { key: 'h' },
            },
          },
          overrides: [
            {
              delete: ['view.keyboard_shortcuts'],
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            },
          ],
        });

        manager.setConfig(config);
        await flushPromises();

        // Verify keyboard shortcuts automations were added initially with ptz_home
        expect(addAutomationsSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              conditions: expect.arrayContaining([
                expect.objectContaining({ condition: 'key', key: 'h' }),
              ]),
              actions: expect.arrayContaining([
                expect.objectContaining({
                  advanced_camera_card_action: 'ptz_multi',
                }),
              ]),
            }),
          ]),
        );

        addAutomationsSpy.mockClear();

        // Trigger the override - keyboard_shortcuts should be deleted
        stateManager.setState({ fullscreen: true });
        await flushPromises();

        // Verify newly added automations don't contain keyboard shortcuts (key: 'h')
        // This confirms the override removed them (directly verified through add calls)
        const addCalls = addAutomationsSpy.mock.calls;
        const hasKeyboardShortcut = addCalls.some((call) =>
          call[0].some((automation: Automation) =>
            automation.conditions?.some(
              (cond: AdvancedCameraCardCondition) =>
                cond.condition === 'key' && cond.key === 'h',
            ),
          ),
        );
        expect(hasKeyboardShortcut).toBe(false);
      });

      it('should re-run folders loader when overrides change', async () => {
        const { manager, stateManager, api } = createConfigManagerTestSetup();

        const folders = [{ id: 'f' }];
        const config = createConfig({
          folders,
          overrides: [
            {
              delete: ['folders'],
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            },
          ],
        });

        manager.setConfig(config);
        await flushPromises();

        // Verify initial payload (folders may be populated with defaults, so
        // assert the passed folders contain our folder id).
        expect(api.getFoldersManager().addFolders).toHaveBeenCalled();
        expect(api.getFoldersManager().addFolders).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ id: 'f' })]),
        );

        // Reset calls so we only see calls resulting from the override
        vi.mocked(api.getFoldersManager().deleteFolders).mockClear();
        vi.mocked(api.getFoldersManager().addFolders).mockClear();

        // Trigger override which deletes folders
        stateManager.setState({ fullscreen: true });
        await flushPromises();

        // Verify delete was called when override triggered
        expect(api.getFoldersManager().deleteFolders).toBeCalled();

        // Verify folder 'f' is no longer present after override
        // Since the override removes folders, the folders passed should no
        // longer include our folder `f`.
        const calls = vi.mocked(api.getFoldersManager().addFolders).mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(1);
        const lastArg = calls[calls.length - 1][0] as unknown[];
        expect(lastArg).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: 'f' })]),
        );

        // Verify folder is restored when override exits
        vi.mocked(api.getFoldersManager().addFolders).mockClear();

        stateManager.setState({ fullscreen: false });
        await flushPromises();

        // Verify the folder 'f' is restored
        const restoreCalls = vi.mocked(api.getFoldersManager().addFolders).mock.calls;
        expect(restoreCalls.length).toBeGreaterThanOrEqual(1);
        const restoredArg = restoreCalls[restoreCalls.length - 1][0] as unknown[];
        expect(restoredArg).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: 'f' })]),
        );
      });

      it('should re-run automations loader when overrides change and properly manage automations', async () => {
        const { manager, stateManager, api, addAutomationsSpy, deleteAutomationsSpy } =
          createConfigManagerTestSetup();

        // Mock executeActions to track automation execution
        const executeActionsMock = vi.fn();
        vi.mocked(api.getActionsManager().executeActions).mockImplementation(
          executeActionsMock,
        );

        const automation = {
          conditions: [TEST_CONDITIONS.FULLSCREEN_OFF],
          actions: [createGeneralAction('screenshot')],
        };
        const config = createConfig({
          automations: [automation],
          overrides: [
            {
              delete: ['automations'],
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            },
          ],
        });

        manager.setConfig(config);
        await flushPromises();

        // Verify automations were added initially
        expect(addAutomationsSpy).toHaveBeenCalled();

        // Trigger a state change to evaluate conditions (fullscreen: false matches our condition)
        stateManager.setState({ fullscreen: false });
        await flushPromises();

        // The automation should execute since the condition matches and override is not active
        expect(executeActionsMock).toHaveBeenCalled();

        // Clear to observe only calls caused by the override
        executeActionsMock.mockClear();
        deleteAutomationsSpy.mockClear();
        addAutomationsSpy.mockClear();

        // Trigger the override which deletes automations
        stateManager.setState({ fullscreen: true });
        await flushPromises();

        // Verify delete was called when override triggered
        expect(deleteAutomationsSpy).toHaveBeenCalled();

        // After override, the automation should have been deleted from the manager,
        // so no further executions should occur
        expect(executeActionsMock).not.toHaveBeenCalled();

        // Clear and verify that exiting fullscreen doesn't restore the automation
        executeActionsMock.mockClear();

        stateManager.setState({ fullscreen: false });
        await flushPromises();

        // The automation should still not execute because it was deleted by the override
        expect(executeActionsMock).not.toHaveBeenCalled();
      });
    });

    describe('remote-control loader with overrides', () => {
      it('should re-run remote-control loader when overrides change', async () => {
        const { manager, stateManager, addAutomationsSpy, deleteAutomationsSpy } =
          createConfigManagerTestSetup();

        const config = createConfig({
          remote_control: {
            entities: { camera: 'input_select.camera' },
          },
          overrides: [
            {
              delete: ['remote_control'],
              conditions: [TEST_CONDITIONS.FULLSCREEN_ON],
            },
          ],
        });

        // Initial set should register remote control automations
        manager.setConfig(config);
        await flushPromises();

        // Verify remote-control automations were added initially with config condition
        expect(addAutomationsSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              conditions: expect.arrayContaining([
                expect.objectContaining({
                  condition: 'config',
                  paths: expect.arrayContaining(['remote_control.entities.camera']),
                }),
              ]),
            }),
          ]),
        );

        addAutomationsSpy.mockClear();
        deleteAutomationsSpy.mockClear();

        // Trigger the override condition - remote_control should be deleted
        stateManager.setState({ fullscreen: true });
        await flushPromises();

        // Verify delete was called
        expect(deleteAutomationsSpy).toHaveBeenCalled();

        // Verify new automations don't contain remote-control config conditions
        const addCalls = addAutomationsSpy.mock.calls;
        const hasRemoteControl = addCalls.some((call) =>
          call[0].some((automation: Automation) =>
            automation.conditions?.some(
              (cond: AdvancedCameraCardCondition) =>
                cond.condition === 'config' &&
                cond.paths?.includes('remote_control.entities.camera'),
            ),
          ),
        );
        expect(hasRemoteControl).toBe(false);

        addAutomationsSpy.mockClear();

        // Exit override - remote-control automations should be restored
        stateManager.setState({ fullscreen: false });
        await flushPromises();

        // Verify remote-control automations were restored
        expect(addAutomationsSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              conditions: expect.arrayContaining([
                expect.objectContaining({
                  condition: 'config',
                  paths: expect.arrayContaining(['remote_control.entities.camera']),
                }),
              ]),
            }),
          ]),
        );
      });
    });
  });
});
