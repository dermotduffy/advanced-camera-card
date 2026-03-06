import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  InitializationAspect,
  InitializationManager,
} from '../../src/card-controller/initialization-manager';
import { ConditionStateManager } from '../../src/conditions/state-manager';
import { sideLoadHomeAssistantElements } from '../../src/ha/side-load-ha-elements.js';
import { loadLanguages } from '../../src/localize/localize';
import { Initializer } from '../../src/utils/initializer/initializer';
import { createCardAPI, createConfig, createHASS } from '../test-utils';

vi.mock('../../src/localize/localize.js');
vi.mock('../../src/ha/side-load-ha-elements.js');

// @vitest-environment jsdom
describe('InitializationManager', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
  });

  describe('should correctly determine when mandatory initialization is required', () => {
    it('without config', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      expect(manager.isInitializedMandatory()).toBeFalsy();
    });

    it('without aspects', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      expect(manager.isInitializedMandatory()).toBeFalsy();
    });

    it('with microphone if configured', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(
        api.getMicrophoneManager().shouldConnectOnInitialization,
      ).mockReturnValue(true);

      expect(manager.isInitializedMandatory()).toBeFalsy();
    });
  });

  describe('should initialize mandatory', () => {
    it('without hass', async () => {
      const manager = new InitializationManager(createCardAPI());
      await manager.initializeMandatory();
      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('without config', async () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(loadLanguages).mockResolvedValue(true);
      vi.mocked(sideLoadHomeAssistantElements).mockResolvedValue(true);

      await manager.initializeMandatory();
      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('successfully', async () => {
      const stateListener = vi.fn();
      const stateMananger = new ConditionStateManager();
      stateMananger.addListener(stateListener);

      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateMananger);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const config = createConfig();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);
      vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(false);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActionsToRun).mockReturnValue(
        false,
      );
      vi.mocked(loadLanguages).mockResolvedValue(true);
      vi.mocked(sideLoadHomeAssistantElements).mockResolvedValue(true);
      vi.mocked(api.getCameraManager().initializeCamerasFromConfig).mockResolvedValue(
        true,
      );
      vi.mocked(api.getViewManager().initialize).mockResolvedValue(true);

      const manager = new InitializationManager(api);

      expect(manager.isInitialized(InitializationAspect.LANGUAGES)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.SIDE_LOAD_ELEMENTS)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.CAMERAS)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.MICROPHONE_CONNECT)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.VIEW)).toBeFalsy();

      await manager.initializeMandatory();

      expect(loadLanguages).toBeCalled();
      expect(sideLoadHomeAssistantElements).toBeCalled();
      expect(api.getCameraManager().initializeCamerasFromConfig).toBeCalled();
      expect(api.getViewManager().initialize).toBeCalled();
      expect(api.getMicrophoneManager().connect).not.toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();

      expect(manager.wasEverInitialized()).toBeTruthy();

      expect(stateListener).toBeCalledWith(
        expect.objectContaining({
          change: {
            initialized: true,
            config,
          },
        }),
      );

      expect(manager.isInitialized(InitializationAspect.LANGUAGES)).toBeTruthy();
      expect(
        manager.isInitialized(InitializationAspect.SIDE_LOAD_ELEMENTS),
      ).toBeTruthy();
      expect(manager.isInitialized(InitializationAspect.CAMERAS)).toBeTruthy();
      expect(manager.isInitialized(InitializationAspect.MICROPHONE_CONNECT)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.VIEW)).toBeTruthy();
      expect(manager.isInitialized(InitializationAspect.INITIAL_TRIGGER)).toBeTruthy();
    });

    it('successfully with microphone if configured', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(
        api.getMicrophoneManager().shouldConnectOnInitialization,
      ).mockReturnValue(true);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(loadLanguages).mockResolvedValue(true);
      vi.mocked(sideLoadHomeAssistantElements).mockResolvedValue(true);
      vi.mocked(api.getCameraManager().initializeCamerasFromConfig).mockResolvedValue(
        true,
      );

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(api.getMicrophoneManager().connect).toBeCalled();
    });

    it('with message set during initialization', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(true);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActionsToRun).mockReturnValue(
        false,
      );
      vi.mocked(loadLanguages).mockResolvedValue(true);
      vi.mocked(sideLoadHomeAssistantElements).mockResolvedValue(true);
      vi.mocked(api.getCameraManager().initializeCamerasFromConfig).mockResolvedValue(
        true,
      );

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(api.getViewManager().initialize).not.toBeCalled();
    });

    it('with languages and side load elements in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(false);

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('with cameras in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('with triggers in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      initializer.initializeIfNecessary
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
    });
  });

  it('should uninitialize', () => {
    const initializer = mock<Initializer>();
    const manager = new InitializationManager(createCardAPI(), initializer);

    manager.uninitialize(InitializationAspect.CAMERAS);

    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.CAMERAS);
  });
});
