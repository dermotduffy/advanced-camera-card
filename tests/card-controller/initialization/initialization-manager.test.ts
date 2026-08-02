import { STATE_RUNNING, STATE_STARTING } from 'home-assistant-js-websocket';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  InitializationAspect,
  InitializationManager,
} from '../../../src/card-controller/initialization/initialization-manager';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { sideLoadHomeAssistantElements } from '../../../src/ha/side-load-ha-elements.js';
import { loadLanguages } from '../../../src/localize/localize';
import type { Initializer } from '../../../src/utils/initializer/initializer';
import { createConfig } from '../../config/test-utils';
import { createCardAPI, createHASS } from '../../test-utils';

vi.mock('../../../src/localize/localize.js');
vi.mock('../../../src/ha/side-load-ha-elements.js');

// An API that passes the whole start predicate, checked both when an attempt is
// queued and again when it runs.
const createReadyAPI = (): ReturnType<typeof createCardAPI> => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(true);
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
  vi.mocked(api.getCardElementManager().isConnected).mockReturnValue(true);
  const hass = createHASS();
  hass.connected = true;
  hass.config.state = STATE_RUNNING;
  vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
  vi.mocked(api.getIssueManager().getStateManager().hasFullCardIssue).mockReturnValue(
    false,
  );
  return api;
};

describe('InitializationManager', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
  });

  describe('should correctly determine when mandatory initialization is required', () => {
    it('should handle without config', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      expect(manager.areMandatoryAspectsInitialized()).toBeFalsy();
    });

    it('should handle without aspects', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      expect(manager.areMandatoryAspectsInitialized()).toBeFalsy();
    });

    it('should handle with microphone if configured', () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);

      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(
        api.getMicrophoneManager().shouldConnectOnInitialization,
      ).mockReturnValue(true);

      expect(manager.areMandatoryAspectsInitialized()).toBeFalsy();
    });
  });

  describe('should initialize mandatory', () => {
    it('should handle without hass', async () => {
      const manager = new InitializationManager(createCardAPI());
      await manager.initializeMandatory();
      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
    });

    it('should handle without config', async () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      await manager.initializeMandatory();
      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
    });

    it('should be a no-op when hass.config.state is not RUNNING', async () => {
      const api = createReadyAPI();
      const hass = createHASS();
      hass.config.state = STATE_STARTING;
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      await manager.initializeMandatory();

      expect(initializer.initializeMultipleIfNecessary).not.toHaveBeenCalled();
      expect(initializer.initializeIfNecessary).not.toHaveBeenCalled();
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();
      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
    });

    it('should succeed', async () => {
      const stateListener = vi.fn();
      const stateMananger = new ConditionStateManager();
      stateMananger.addListener(stateListener);

      const api = createReadyAPI();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateMananger);
      const config = createConfig();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);
      const manager = new InitializationManager(api);

      expect(manager.isInitialized(InitializationAspect.LANGUAGES)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.SIDE_LOAD_ELEMENTS)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.CAMERAS)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.MICROPHONE_CONNECT)).toBeFalsy();
      expect(manager.isInitialized(InitializationAspect.VIEW)).toBeFalsy();

      await manager.initializeMandatory();

      expect(loadLanguages).toHaveBeenCalled();
      expect(sideLoadHomeAssistantElements).toHaveBeenCalled();
      expect(api.getCameraManager().initializeCamerasFromConfig).toHaveBeenCalled();
      expect(api.getViewManager().initialize).toHaveBeenCalled();
      expect(api.getMicrophoneManager().connect).not.toHaveBeenCalled();
      expect(api.getCardElementManager().update).toHaveBeenCalled();

      expect(manager.getSessionManager().wasEverInitialized()).toBeTruthy();

      expect(stateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          change: {
            initialized: true,
            everInitialized: true,
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

    it('should load the template renderer for a templated config', async () => {
      const api = createReadyAPI();
      vi.mocked(api.getConfigManager().hasTemplate).mockReturnValue(true);
      const loadRenderer = vi.mocked(api.getTemplateManager().loadRenderer);

      const manager = new InitializationManager(api);

      expect(manager.isInitialized(InitializationAspect.TEMPLATE_RENDERER)).toBeFalsy();

      await manager.initializeMandatory();

      expect(loadRenderer).toHaveBeenCalled();
      expect(manager.isInitialized(InitializationAspect.TEMPLATE_RENDERER)).toBeTruthy();
      expect(manager.areMandatoryAspectsInitialized()).toBeTruthy();
    });

    it('should not load the template renderer for a config without templates', async () => {
      const api = createReadyAPI();
      vi.mocked(api.getConfigManager().hasTemplate).mockReturnValue(false);
      const loadRenderer = vi.mocked(api.getTemplateManager().loadRenderer);

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(loadRenderer).not.toHaveBeenCalled();
      expect(manager.isInitialized(InitializationAspect.TEMPLATE_RENDERER)).toBeFalsy();
      expect(manager.areMandatoryAspectsInitialized()).toBeTruthy();
    });

    it('should succeed with microphone if configured', async () => {
      const api = createReadyAPI();
      vi.mocked(
        api.getMicrophoneManager().shouldConnectOnInitialization,
      ).mockReturnValue(true);

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(api.getMicrophoneManager().connect).toHaveBeenCalled();
    });

    it('should not report a session that ended while it was initializing', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new InitializationManager(api);

      // The card leaves the page midway through, e.g. because the dashboard tab
      // changed while the cameras were still initializing.
      vi.mocked(api.getViewManager().initialize).mockImplementation(async () => {
        manager.getSessionManager().end();
        return true;
      });

      await manager.initializeMandatory();

      // Ending a session before the card started writes nothing: there is
      // nothing to take back.
      expect(stateManager.getState().initialized).toBeUndefined();
      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
    });

    it('should stop when a full-card issue appears during initialization', async () => {
      const api = createReadyAPI();

      // The predicate passes at dequeue time, then a full-card issue (from any
      // source) appears after the first step: the run stops there without an error
      // of its own.
      vi.mocked(api.getIssueManager().getStateManager().hasFullCardIssue)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(api.getCameraManager().initializeCamerasFromConfig).not.toHaveBeenCalled();
      expect(api.getViewManager().initialize).not.toHaveBeenCalled();
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();
    });

    it('should handle a languages and side load elements failure', async () => {
      const api = createReadyAPI();
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockRejectedValue(
        new Error('initialization failed'),
      );

      await manager.initializeMandatory();

      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
    });

    it('should handle cameras initialization failure', async () => {
      const api = createReadyAPI();

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      // First call (languages/side-load) succeeds, second (cameras) fails.
      initializer.initializeMultipleIfNecessary
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('cameras failed'));

      await manager.initializeMandatory();

      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should handle initial trigger initialization failure', async () => {
      const api = createReadyAPI();

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);

      // First initializeIfNecessary call (view) succeeds, second
      // (initial_trigger) fails.
      initializer.initializeIfNecessary
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('triggers failed'));

      await manager.initializeMandatory();

      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should handle VIEW initialization failure', async () => {
      const api = createReadyAPI();

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);
      initializer.initializeIfNecessary.mockRejectedValueOnce(
        new Error('view initialization failed'),
      );

      await manager.initializeMandatory();

      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should stop without an error when an aspect declines', async () => {
      const api = createReadyAPI();

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);

      // An aspect that could not complete (e.g. the view when no view could be
      // set) declines rather than throwing: the run stops so a later attempt
      // retries, and no initialization error is raised.
      initializer.initializeIfNecessary.mockResolvedValueOnce(false);

      await manager.initializeMandatory();

      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).not.toHaveBeenCalledWith(
        'initialization',
        expect.anything(),
      );
    });

    it('should handle non-Error thrown during initialization', async () => {
      const api = createReadyAPI();

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      // Throw a non-Error to exercise the else-branch in _runStep
      initializer.initializeMultipleIfNecessary.mockRejectedValueOnce('string error');

      await manager.initializeMandatory();

      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'initialization',
        expect.objectContaining({ error: 'string error' }),
      );
    });

    it('should decline when the config vanishes mid-initialization', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      // The config disappears while languages load. The CAMERAS initializer
      // quietly does nothing without a configuration, so the run must stop
      // before that aspect would be marked initialized against nothing.
      vi.mocked(loadLanguages).mockImplementation(async () => {
        vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(false);
      });

      const manager = new InitializationManager(api);
      await manager.initializeMandatory();

      expect(api.getCameraManager().initializeCamerasFromConfig).not.toHaveBeenCalled();
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();
      expect(stateManager.getState().initialized).toBeUndefined();
    });

    it('should subscribe automations before reporting the card started', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      // A trigger watching `initialized` or `config` must already be attached
      // when that state is written, so it can fire on that very change.
      const order: string[] = [];
      vi.mocked(api.getAutomationsManager().subscribe).mockImplementation(() => {
        order.push('subscribe');
      });
      stateManager.addListener(() => order.push('report'));

      const manager = new InitializationManager(api);
      await manager.initializeMandatory();

      expect(order).toEqual(['subscribe', 'report']);
    });

    it('should read the config when reporting the card started', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      // The configuration changes while the view initializes: the card must be
      // reported started against the configuration as it stands then, not as it
      // stood when the run began.
      const newConfig = createConfig({ menu: { style: 'none' } });
      vi.mocked(api.getViewManager().initialize).mockImplementation(async () => {
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(newConfig);
        return true;
      });

      const manager = new InitializationManager(api);
      await manager.initializeMandatory();

      expect(stateManager.getState().initialized).toBe(true);
      expect(stateManager.getState().config).toBe(newConfig);
    });

    it('should decline when the config is null at the end of a run', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      vi.mocked(api.getViewManager().initialize).mockImplementation(async () => {
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);
        return true;
      });

      const manager = new InitializationManager(api);
      await manager.initializeMandatory();

      expect(stateManager.getState().initialized).toBeUndefined();
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();

      // A configuration can only return by being set, which invalidates the
      // VIEW aspect -- after which the next attempt reports normally.
      const config = createConfig();
      vi.mocked(api.getViewManager().initialize).mockResolvedValue(true);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);
      manager.invalidateAspect(InitializationAspect.VIEW);

      await manager.initializeMandatory();

      expect(stateManager.getState().initialized).toBe(true);
      expect(stateManager.getState().config).toBe(config);
    });
  });

  describe('should handle later runs in a session', () => {
    it('should end the session when a later run fails', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
      const manager = new InitializationManager(api);

      await manager.initializeMandatory();
      expect(stateManager.getState().initialized).toBe(true);

      manager.invalidateAspect(InitializationAspect.VIEW);
      vi.mocked(api.getViewManager().initialize).mockRejectedValue(
        new Error('view failed'),
      );

      await manager.initializeMandatory();

      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(stateManager.getState().initialized).toBe(false);

      // A card that has come back down has still ever been initialized.
      expect(stateManager.getState().everInitialized).toBe(true);
    });

    it('should keep the session when a later run declines', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
      const manager = new InitializationManager(api);

      await manager.initializeMandatory();
      expect(stateManager.getState().initialized).toBe(true);

      manager.invalidateAspect(InitializationAspect.VIEW);
      vi.mocked(api.getViewManager().initialize).mockResolvedValue(false);

      await manager.initializeMandatory();

      expect(stateManager.getState().initialized).toBe(true);
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();
    });
  });

  describe('should refuse initializations that were overtaken', () => {
    it('should refuse an attempt queued before a disconnect', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
      const manager = new InitializationManager(api);

      let releaseCameras = (): void => {};
      const blockedCameras = new Promise<void>((resolve) => {
        releaseCameras = resolve;
      });
      vi.mocked(api.getCameraManager().initializeCamerasFromConfig).mockImplementation(
        () => blockedCameras,
      );

      const first = manager.initializeMandatory();
      const second = manager.initializeMandatory();

      await vi.waitFor(() =>
        expect(api.getCameraManager().initializeCamerasFromConfig).toHaveBeenCalled(),
      );

      // The card leaves the page while the first initialization awaits the
      // cameras and the second attempt waits in the queue.
      vi.mocked(api.getCardElementManager().isConnected).mockReturnValue(false);
      manager.invalidateAspect(InitializationAspect.CAMERAS);
      manager.invalidateAspect(InitializationAspect.INITIAL_TRIGGER);
      manager.getSessionManager().end();

      releaseCameras();
      await first;
      await second;

      expect(api.getCameraManager().initializeCamerasFromConfig).toHaveBeenCalledTimes(
        1,
      );
      expect(stateManager.getState().initialized).toBeUndefined();
      expect(manager.getSessionManager().wasEverInitialized()).toBeFalsy();
    });

    it('should not raise an issue when a superseded initialization fails', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
      const manager = new InitializationManager(api);

      let failCameras = (): void => {};
      const blockedCameras = new Promise<void>((_, reject) => {
        failCameras = (): void => reject(new Error('cameras torn down'));
      });
      vi.mocked(api.getCameraManager().initializeCamerasFromConfig).mockImplementation(
        () => blockedCameras,
      );

      const attempt = manager.initializeMandatory();
      await vi.waitFor(() =>
        expect(api.getCameraManager().initializeCamerasFromConfig).toHaveBeenCalled(),
      );

      // The card leaves the page, and the in-flight camera work then fails
      // because of that very teardown. An error from a card state that no
      // longer exists must not become a full-card issue that greets the card
      // when it returns.
      vi.mocked(api.getCardElementManager().isConnected).mockReturnValue(false);
      manager.invalidateAspect(InitializationAspect.CAMERAS);
      manager.invalidateAspect(InitializationAspect.INITIAL_TRIGGER);
      manager.getSessionManager().end();

      failCameras();
      await attempt;

      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();
      expect(stateManager.getState().initialized).toBeUndefined();
    });

    it('should decline when an aspect was invalidated mid-initialization', async () => {
      const api = createReadyAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
      const manager = new InitializationManager(api);

      // A configuration change lands while the initial trigger step runs,
      // invalidating an aspect an earlier step already completed. Reporting the
      // card started then would call it ready with stale cameras -- and the
      // initialization that follows would not make `initialized` change again.
      vi.mocked(
        api.getCameraTriggersManager().handleInitialCameraTriggers,
      ).mockImplementation(async () => {
        manager.invalidateAspect(InitializationAspect.CAMERAS);
        return true;
      });

      await manager.initializeMandatory();

      expect(stateManager.getState().initialized).toBeUndefined();
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();

      // The next attempt initializes the invalidated aspect and reports the
      // card started.
      await manager.initializeMandatory();

      expect(stateManager.getState().initialized).toBe(true);
    });
  });

  describe('should invalidate aspects', () => {
    const createInitializedAPI = (): {
      api: ReturnType<typeof createCardAPI>;
      initializer: ReturnType<typeof mock<Initializer>>;
      stateManager: ConditionStateManager;
    } => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      stateManager.setState({ initialized: true, everInitialized: true });
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      return { api, initializer: mock<Initializer>(), stateManager };
    };

    it('should invalidate mandatory aspects without ending the session', () => {
      const { api, initializer, stateManager } = createInitializedAPI();
      const manager = new InitializationManager(api, initializer);

      manager.invalidateMandatoryAspects();

      expect(initializer.uninitialize).toHaveBeenCalledWith(
        InitializationAspect.CAMERAS,
      );
      expect(initializer.uninitialize).toHaveBeenCalledWith(
        InitializationAspect.MICROPHONE_CONNECT,
      );
      expect(initializer.uninitialize).toHaveBeenCalledWith(
        InitializationAspect.TEMPLATE_RENDERER,
      );
      expect(initializer.uninitialize).toHaveBeenCalledWith(InitializationAspect.VIEW);
      expect(initializer.uninitialize).toHaveBeenCalledWith(
        InitializationAspect.INITIAL_TRIGGER,
      );
      expect(stateManager.getState().initialized).toBe(true);
    });

    it('should keep the current session when an aspect is being invalidated', () => {
      const { api, initializer, stateManager } = createInitializedAPI();
      const manager = new InitializationManager(api, initializer);

      manager.invalidateAspect(InitializationAspect.CAMERAS);

      expect(initializer.uninitialize).toHaveBeenCalledWith(
        InitializationAspect.CAMERAS,
      );
      expect(stateManager.getState().initialized).toBe(true);
    });
  });

  describe('should decide whether to trigger initialization', () => {
    it('should initialize when all conditions are met', () => {
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(createReadyAPI(), initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).toHaveBeenCalled();
    });

    it('should not initialize without config', () => {
      const api = createReadyAPI();
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(false);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toHaveBeenCalled();
    });

    it('should not initialize when the element is disconnected', () => {
      const api = createReadyAPI();
      vi.mocked(api.getCardElementManager().isConnected).mockReturnValue(false);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toHaveBeenCalled();
    });

    it('should not initialize when hass is not ready', () => {
      const api = createReadyAPI();
      const hass = createHASS();
      hass.connected = true;
      hass.config.state = STATE_STARTING;
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toHaveBeenCalled();
    });

    it('should not initialize when already initialized', () => {
      const initializer = mock<Initializer>();
      initializer.isInitializedMultiple.mockReturnValue(true);
      const manager = new InitializationManager(createReadyAPI(), initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toHaveBeenCalled();
    });

    it('should not initialize while a full-card issue is shown', () => {
      const api = createReadyAPI();
      vi.mocked(
        api.getIssueManager().getStateManager().hasFullCardIssue,
      ).mockReturnValue(true);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toHaveBeenCalled();
    });
  });
});
