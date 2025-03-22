import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ConfigManager } from '../../../src/card-controller/config/config-manager';
import { InitializationAspect } from '../../../src/card-controller/initialization-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createCardAPI, flushPromises } from '../../test-utils';

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
        'Invalid configuration: [\n "cameras",\n "type"\n]',
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
      cameras: [{ camera_entity: 'camera.office' }],
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
      cameras: [{ camera_entity: 'camera.office' }],
      profiles: ['low-performance'],
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
      cameras: [{ camera_entity: 'camera.office' }],
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
      cameras: [{ camera_entity: 'camera.office' }],
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
          media_chunk_size: 50,
        },
        style: {
          border_radius: true,
          box_shadow: false,
        },
      },
    });
  });

  it('should ignore overrides with same config', () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ConfigManager(api);
    const cameras = [{ camera_entity: 'camera.office' }];
    const config = {
      type: 'custom:advanced-camera-card',
      cameras: cameras,
      overrides: [
        {
          conditions: [{ condition: 'fullscreen', fullscreen: true }],
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

  it('should override', () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:advanced-camera-card',
      cameras: [{ camera_entity: 'camera.office' }],
      menu: {
        style: 'hidden',
      },
      overrides: [
        {
          conditions: [{ condition: 'fullscreen', fullscreen: true }],
          set: { 'menu.style': 'none' },
        },
      ],
    };

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
      cameras: [{ camera_entity: 'camera.office' }],
      overrides: [
        {
          conditions: [{ condition: 'fullscreen', fullscreen: true }],
          delete: ['cameras'],
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
        cameras: [{ camera_entity: 'camera.office' }],
        overrides: [
          {
            conditions: [{ condition: 'fullscreen', fullscreen: true }],
            set: {
              cameras: [{ camera_entity: 'camera.kitchen' }],
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
        cameras: [{ camera_entity: 'camera.office' }],
        overrides: [
          {
            conditions: [{ condition: 'fullscreen', fullscreen: true }],
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
        cameras: [{ camera_entity: 'camera.office' }],
        overrides: [
          {
            conditions: [{ condition: 'fullscreen', fullscreen: true }],
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
        cameras: [{ camera_entity: 'camera.office' }],
        overrides: [
          {
            conditions: [{ condition: 'fullscreen', fullscreen: true }],
            set: {
              cameras: [{ camera_entity: 'camera.kitchen' }],
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
});
