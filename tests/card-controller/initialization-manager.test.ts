import { STATE_RUNNING, STATE_STARTING } from 'home-assistant-js-websocket';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  InitializationAspect,
  InitializationManager,
} from '../../src/card-controller/initialization-manager';
import { ConditionStateManager } from '../../src/condition-trigger/conditions/state-manager';
import { sideLoadHomeAssistantElements } from '../../src/ha/side-load-ha-elements.js';
import { loadLanguages } from '../../src/localize/localize';
import type { Initializer } from '../../src/utils/initializer/initializer';
import { createCardAPI, createConfig, createHASS } from '../test-utils';

vi.mock('../../src/localize/localize.js');
vi.mock('../../src/ha/side-load-ha-elements.js');

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

    it('should be a no-op when hass.config.state is not RUNNING', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      hass.config.state = STATE_STARTING;
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      await manager.initializeMandatory();

      expect(initializer.initializeMultipleIfNecessary).not.toBeCalled();
      expect(initializer.initializeIfNecessary).not.toBeCalled();
      expect(api.getIssueManager().trigger).not.toBeCalled();
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
        api.getIssueManager().getStateManager().hasFullCardIssue,
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

    it('should load the template renderer for a templated config', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getConfigManager().hasTemplate).mockReturnValue(true);
      const loadRenderer = vi.mocked(api.getTemplateManager().loadRenderer);

      const manager = new InitializationManager(api);

      expect(manager.isInitialized(InitializationAspect.TEMPLATE_RENDERER)).toBeFalsy();

      await manager.initializeMandatory();

      expect(loadRenderer).toBeCalled();
      expect(manager.isInitialized(InitializationAspect.TEMPLATE_RENDERER)).toBeTruthy();
      expect(manager.isInitializedMandatory()).toBeTruthy();
    });

    it('should not load the template renderer for a config without templates', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getConfigManager().hasTemplate).mockReturnValue(false);
      const loadRenderer = vi.mocked(api.getTemplateManager().loadRenderer);

      const manager = new InitializationManager(api);

      await manager.initializeMandatory();

      expect(loadRenderer).not.toBeCalled();
      expect(manager.isInitialized(InitializationAspect.TEMPLATE_RENDERER)).toBeFalsy();
      expect(manager.isInitializedMandatory()).toBeTruthy();
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
        api.getIssueManager().getStateManager().hasFullCardIssue,
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
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('cameras failed'));

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toBeCalledWith(
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

      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);

      // First initializeIfNecessary call (view) succeeds, second
      // (initial_trigger) fails.
      initializer.initializeIfNecessary
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('triggers failed'));

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toBeCalledWith(
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
      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);
      initializer.initializeIfNecessary.mockRejectedValueOnce(
        new Error('view initialization failed'),
      );

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).toBeCalledWith(
        'initialization',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should stop without an error when an aspect reports failure', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);

      // An aspect that could not complete (e.g. the view when no view could be
      // set) reports failure rather than throwing: the chain stops so a later
      // attempt retries, and no initialization error is raised.
      initializer.initializeIfNecessary.mockResolvedValueOnce(false);

      await manager.initializeMandatory();

      expect(manager.wasEverInitialized()).toBeFalsy();
      expect(api.getIssueManager().trigger).not.toBeCalledWith(
        'initialization',
        expect.anything(),
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
      expect(api.getIssueManager().trigger).toBeCalledWith(
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
    expect(initializer.uninitialize).toBeCalledWith(
      InitializationAspect.TEMPLATE_RENDERER,
    );
    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.VIEW);
    expect(initializer.uninitialize).toBeCalledWith(
      InitializationAspect.INITIAL_TRIGGER,
    );
  });

  it('should uninitialize', () => {
    const initializer = mock<Initializer>();
    const manager = new InitializationManager(createCardAPI(), initializer);

    manager.uninitialize(InitializationAspect.CAMERAS);

    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.CAMERAS);
  });

  describe('should decide whether to trigger initialization', () => {
    const createReadyAPI = () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(true);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCardElementManager().isConnected).mockReturnValue(true);
      const hass = createHASS();
      hass.connected = true;
      hass.config.state = STATE_RUNNING;
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      vi.mocked(
        api.getIssueManager().getStateManager().hasFullCardIssue,
      ).mockReturnValue(false);
      return api;
    };

    it('should initialize when all conditions are met', () => {
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(createReadyAPI(), initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).toBeCalled();
    });

    it('should not initialize without config', () => {
      const api = createReadyAPI();
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(false);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toBeCalled();
    });

    it('should not initialize when the element is disconnected', () => {
      const api = createReadyAPI();
      vi.mocked(api.getCardElementManager().isConnected).mockReturnValue(false);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toBeCalled();
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

      expect(initializer.initializeMultipleIfNecessary).not.toBeCalled();
    });

    it('should not initialize when already initialized', () => {
      const initializer = mock<Initializer>();
      initializer.isInitializedMultiple.mockReturnValue(true);
      const manager = new InitializationManager(createReadyAPI(), initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toBeCalled();
    });

    it('should not initialize while a full-card issue is shown', () => {
      const api = createReadyAPI();
      vi.mocked(
        api.getIssueManager().getStateManager().hasFullCardIssue,
      ).mockReturnValue(true);
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);

      manager.triggerInitialization();

      expect(initializer.initializeMultipleIfNecessary).not.toBeCalled();
    });
  });
});
