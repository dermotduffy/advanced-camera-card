import { describe, expect, it, vi } from 'vitest';

import {
  SessionManager,
  SessionState,
} from '../../../src/card-controller/initialization/session-manager';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createTriggerEvaluator } from '../../../src/condition-trigger/triggers/factory';
import { initializedTriggerSchema } from '../../../src/config/schema/condition-trigger/triggers/custom/initialized';
import { createTriggerEvaluatorContext } from '../../condition-trigger/triggers/triggers/test-utils';
import { createConfig } from '../../config/test-utils';
import { createCardAPI } from '../../test-utils';

const createSessionManager = (): {
  sessionManager: SessionManager;
  stateManager: ConditionStateManager;
} => {
  const api = createCardAPI();
  const stateManager = new ConditionStateManager();
  vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

  return { sessionManager: new SessionManager(api), stateManager };
};

// Take a session through a successful initialization run, leaving the card
// started (RUNNING).
const completeInitialization = (
  sessionManager: SessionManager,
  config = createConfig(),
): void => {
  sessionManager.reportInitializationSucceeded(
    sessionManager.startInitialization(),
    config,
  );
};

describe('SessionManager', () => {
  it('should start idle with nothing published', () => {
    const { sessionManager, stateManager } = createSessionManager();

    expect(sessionManager.getState()).toBe(SessionState.IDLE);
    expect(sessionManager.wasEverInitialized()).toBeFalsy();
    expect(stateManager.getState().initialized).toBeUndefined();
  });

  describe('should start initializations', () => {
    it('should start the first initialization of a session', () => {
      const { sessionManager } = createSessionManager();

      const token = sessionManager.startInitialization();

      expect(sessionManager.getState()).toBe(SessionState.INITIALIZING);
      expect(sessionManager.isCurrentInitialization(token)).toBeTruthy();
    });

    it('should keep a started card while an aspect is initialized again', () => {
      const { sessionManager } = createSessionManager();
      completeInitialization(sessionManager);

      sessionManager.startInitialization();

      expect(sessionManager.getState()).toBe(SessionState.RUNNING);
    });
  });

  describe('should report a successful initialization', () => {
    it('should publish the session and config in one change', () => {
      const { sessionManager, stateManager } = createSessionManager();
      const listener = vi.fn();
      stateManager.addListener(listener);
      const config = createConfig();

      sessionManager.reportInitializationSucceeded(
        sessionManager.startInitialization(),
        config,
      );

      expect(sessionManager.getState()).toBe(SessionState.RUNNING);
      expect(sessionManager.wasEverInitialized()).toBeTruthy();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          change: { config: config, initialized: true, everInitialized: true },
        }),
      );
    });

    it('should republish only the config on a later initialization', () => {
      const { sessionManager, stateManager } = createSessionManager();
      completeInitialization(sessionManager);

      const listener = vi.fn();
      stateManager.addListener(listener);
      const newConfig = createConfig({ menu: { style: 'none' } });
      sessionManager.reportInitializationSucceeded(
        sessionManager.startInitialization(),
        newConfig,
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          change: { config: newConfig },
        }),
      );
    });

    it('should publish nothing on a later initialization with an unchanged config', () => {
      const { sessionManager, stateManager } = createSessionManager();
      completeInitialization(sessionManager);

      const listener = vi.fn();
      stateManager.addListener(listener);
      sessionManager.reportInitializationSucceeded(
        sessionManager.startInitialization(),
        createConfig(),
      );

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('should decline an initialization', () => {
    it('should return to idle before the card has started', () => {
      const { sessionManager, stateManager } = createSessionManager();
      const listener = vi.fn();
      stateManager.addListener(listener);

      sessionManager.reportInitializationDeclined(sessionManager.startInitialization());

      expect(sessionManager.getState()).toBe(SessionState.IDLE);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should keep a started card', () => {
      const { sessionManager, stateManager } = createSessionManager();
      completeInitialization(sessionManager);

      const listener = vi.fn();
      stateManager.addListener(listener);
      sessionManager.reportInitializationDeclined(sessionManager.startInitialization());

      expect(sessionManager.getState()).toBe(SessionState.RUNNING);
      expect(stateManager.getState().initialized).toBe(true);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('should fail an initialization', () => {
    it('should return to idle before the card has started', () => {
      const { sessionManager, stateManager } = createSessionManager();
      const listener = vi.fn();
      stateManager.addListener(listener);

      sessionManager.reportInitializationFailed(sessionManager.startInitialization());

      expect(sessionManager.getState()).toBe(SessionState.IDLE);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should end a started card', () => {
      const { sessionManager, stateManager } = createSessionManager();
      completeInitialization(sessionManager);

      sessionManager.reportInitializationFailed(sessionManager.startInitialization());

      expect(sessionManager.getState()).toBe(SessionState.IDLE);
      expect(stateManager.getState().initialized).toBe(false);

      // A card that has been turndown has still been "ever initialized".
      expect(stateManager.getState().everInitialized).toBe(true);
      expect(sessionManager.wasEverInitialized()).toBeTruthy();
    });
  });

  describe('should end a session', () => {
    it('should return to idle after an ended sessiond', () => {
      const { sessionManager, stateManager } = createSessionManager();
      completeInitialization(sessionManager);

      sessionManager.end();

      expect(sessionManager.getState()).toBe(SessionState.IDLE);
      expect(stateManager.getState().initialized).toBe(false);
    });

    it('should write nothing before the card has started', () => {
      const { sessionManager, stateManager } = createSessionManager();
      const listener = vi.fn();
      stateManager.addListener(listener);

      sessionManager.startInitialization();
      sessionManager.end();

      expect(sessionManager.getState()).toBe(SessionState.IDLE);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should leave the card reported as ever initialized', () => {
      const { sessionManager, stateManager } = createSessionManager();
      completeInitialization(sessionManager);

      sessionManager.end();

      expect(stateManager.getState().everInitialized).toBe(true);
      expect(sessionManager.wasEverInitialized()).toBeTruthy();
    });
  });

  describe('should refuse stale tokens', () => {
    it('should refuse a token from before the session ended', () => {
      const { sessionManager, stateManager } = createSessionManager();
      const listener = vi.fn();
      stateManager.addListener(listener);

      const token = sessionManager.startInitialization();
      sessionManager.end();

      expect(sessionManager.isCurrentInitialization(token)).toBeFalsy();

      sessionManager.reportInitializationSucceeded(token, createConfig());
      sessionManager.reportInitializationDeclined(token);
      sessionManager.reportInitializationFailed(token);

      expect(sessionManager.getState()).toBe(SessionState.IDLE);
      expect(sessionManager.wasEverInitialized()).toBeFalsy();
      expect(listener).not.toHaveBeenCalled();
    });

    it('should refuse a token that was already used', () => {
      const { sessionManager, stateManager } = createSessionManager();
      const listener = vi.fn();
      stateManager.addListener(listener);

      const config = createConfig();
      const token = sessionManager.startInitialization();
      sessionManager.reportInitializationSucceeded(token, config);
      sessionManager.reportInitializationSucceeded(
        token,
        createConfig({ menu: { style: 'none' } }),
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(stateManager.getState().config).toBe(config);
    });
  });

  // The user-facing behaviour the machine exists for, driven through the real
  // schema, trigger factory and evaluator rather than hand-written state.
  describe('should drive the initialized trigger', () => {
    it('should fire once per session and not when a session ends', () => {
      const { sessionManager, stateManager } = createSessionManager();

      const trigger = initializedTriggerSchema.parse({ trigger: 'initialized' });
      const evaluator = createTriggerEvaluator(
        trigger,
        createTriggerEvaluatorContext({ stateManager }),
      );
      const callback = vi.fn();
      evaluator.subscribe(callback);

      completeInitialization(sessionManager);
      expect(callback).toHaveBeenCalledTimes(1);

      // The session ending is a true -> false change of the watched value, but
      // must not fire the trigger.
      sessionManager.end();
      expect(callback).toHaveBeenCalledTimes(1);

      completeInitialization(sessionManager);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});
