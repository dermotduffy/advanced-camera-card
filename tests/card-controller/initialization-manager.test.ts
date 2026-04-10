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
    it('should handle without config', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      expect(manager.isInitializedMandatory()).toBeFalsy();
    });

    it('should handle without aspects', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      expect(manager.isInitializedMandatory()).toBeFalsy();
    });

    it('should handle with microphone if configured', () => {
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
    it('should handle without hass', async () => {
      const manager = new InitializationManager(createCardAPI());
      await manager.initializeMandatory();
      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('should handle without config', async () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      await manager.initializeMandatory();
      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('should succeed', async () => {
      const stateListener = vi.fn();
      const stateMananger = new ConditionStateManager();
      stateMananger.addListener(stateListener);

      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateMananger);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const config = createConfig();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);
      vi.mocked(
        api.getProblemManager().getStateManager().hasFullCardProblem,
      ).mockReturnValue(false);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActionsToRun).mockReturnValue(
        false,
      );
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

    it('should succeed with microphone if configured', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(
        api.getMicrophoneManager().shouldConnectOnInitialization,
      ).mockReturnValue(true);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(api.getMicrophoneManager().connect).toBeCalled();
    });

    it('should handle message set during initialization', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(
        api.getProblemManager().getStateManager().hasFullCardProblem,
      ).mockReturnValue(true);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActionsToRun).mockReturnValue(
        false,
      );

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(api.getViewManager().initialize).not.toBeCalled();
    });

    it('should handle languages and side load elements in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockRejectedValue(
        new Error('initialization failed'),
      );

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
    });

    it('should handle cameras initialization failure', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      // First call (languages/side-load) succeeds, second (cameras) fails.
      initializer.initializeMultipleIfNecessary
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('cameras failed'));

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getProblemManager().trigger).toBeCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should handle initial trigger initialization failure', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      // First initializeIfNecessary call (view) succeeds, second
      // (initial_trigger) fails.
      initializer.initializeIfNecessary
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('triggers failed'));

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getProblemManager().trigger).toBeCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should handle VIEW initialization failure', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeIfNecessary.mockRejectedValueOnce(
        new Error('view initialization failed'),
      );

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getProblemManager().trigger).toBeCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should handle non-Error thrown during initialization', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      // Throw a non-Error to exercise the else-branch in _tryInitialize
      initializer.initializeMultipleIfNecessary.mockRejectedValueOnce('string error');

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getProblemManager().trigger).toBeCalledWith(
        'initialization',
        expect.objectContaining({ error: 'string error' }),
      );
    });
  });

  it('should uninitialize mandatory aspects', () => {
    const initializer = mock<Initializer>();
    const manager = new InitializationManager(createCardAPI(), initializer);

    manager.uninitializeMandatory();

    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.CAMERAS);
    expect(initializer.uninitialize).toBeCalledWith(
      InitializationAspect.MICROPHONE_CONNECT,
    );
    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.VIEW);
    expect(initializer.uninitialize).toBeCalledWith(
      InitializationAspect.INITIAL_TRIGGER,
    );
  });

  it('should report background initialization status', () => {
    const initializer = mock<Initializer>();
    const manager = new InitializationManager(createCardAPI(), initializer);

    initializer.isInitialized.mockReturnValue(false);
    expect(manager.isInitializedBackground()).toBe(false);

    initializer.isInitialized.mockReturnValue(true);
    expect(manager.isInitializedBackground()).toBe(true);

    expect(initializer.isInitialized).toBeCalledWith(InitializationAspect.PROBLEMS);
  });

  describe('should initialize background', () => {
    it('should handle without hass', async () => {
      const api = createCardAPI();
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      await manager.initializeBackground();

      expect(initializer.initializeIfNecessary).not.toBeCalled();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      await manager.initializeBackground();

      expect(initializer.initializeIfNecessary).toBeCalledWith(
        InitializationAspect.PROBLEMS,
        expect.any(Function),
      );
    });

    it('should call detectStatic on problem manager', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const initializer = mock<Initializer>();
      initializer.initializeIfNecessary.mockImplementation(async (_aspect, callback) => {
        if (callback) {
          await callback();
        }
      });

      const manager = new InitializationManager(api, initializer);

      await manager.initializeBackground();

      expect(api.getProblemManager().getStateManager().detectStatic).toBeCalledWith(
        hass,
      );
      expect(api.getProblemManager().evaluate).toBeCalled();
    });
  });

  it('should uninitialize', () => {
    const initializer = mock<Initializer>();
    const manager = new InitializationManager(createCardAPI(), initializer);

    manager.uninitialize(InitializationAspect.CAMERAS);

    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.CAMERAS);
  });
});
