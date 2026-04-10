// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../../src/card-controller/controller';
import { ProblemManager } from '../../../src/card-controller/problems/problem-manager';
import { Problem } from '../../../src/card-controller/problems/types';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { InteractionMode } from '../../../src/config/schema/view';
import { ProblemKey } from '../../../src/card-controller/problems/types';
import { createCardAPI, createConfig } from '../../test-utils';

const DEFAULT_RETRY_SECONDS = 1;

const createProblem = (key: ProblemKey, overrides?: Partial<Problem>): Problem =>
  mock({
    key,
    hasProblem: vi.fn().mockReturnValue(false),
    getProblem: vi.fn().mockReturnValue(null),
    needsRetry: vi.fn().mockReturnValue(false),
    ...overrides,
  });

const createRetriableSetup = (options?: {
  retrySeconds?: number;
  interactionMode?: InteractionMode;
  hasInteraction?: boolean;
}): {
  api: CardController;
  manager: ProblemManager;
  problem: Problem;
} => {
  const api = createCardAPI();
  vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

  if (options?.hasInteraction !== undefined) {
    vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(
      options.hasInteraction,
    );
  }

  const config = createConfig();
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue({
    ...config,
    view: {
      ...config.view,
      errors: {
        interaction_mode: options?.interactionMode ?? 'inactive',
        retry_seconds: options?.retrySeconds ?? DEFAULT_RETRY_SECONDS,
      },
    },
  });

  const manager = new ProblemManager(api);

  const problem = createProblem('media_load', {
    hasProblem: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
    needsRetry: vi.fn().mockReturnValue(true),
    retry: vi.fn().mockReturnValue(false),
  });
  manager.addProblem(problem);

  return { api, manager, problem };
};

describe('ProblemManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register a listener on the condition state manager on construction', () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ProblemManager(api);
    const problem = createProblem('config_error', {
      detectDynamic: vi.fn(),
    });
    manager.addProblem(problem);

    stateManager.setState({ view: 'live' });

    expect(problem.detectDynamic).toBeCalled();
  });

  describe('addProblem / getStateManager', () => {
    it('should make added problems accessible via getManager', () => {
      const manager = new ProblemManager(createCardAPI());

      const problem = createProblem('config_error');
      manager.addProblem(problem);

      expect(manager.getStateManager().getProblemPresence().has('config_error')).toBe(
        false,
      );
    });
  });

  describe('trigger', () => {
    it('should trigger the problem and call evaluate', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new ProblemManager(api);

      const problem = createProblem('config_error', {
        trigger: vi.fn(),
      });
      manager.addProblem(problem);

      manager.trigger('config_error', { error: new Error('cfg') });

      expect(problem.trigger).toBeCalledWith({ error: expect.any(Error) });
    });

    it('should update presence even when state was mutated before detectDynamic', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new ProblemManager(api);

      // hasProblem returns true from the start — simulates trigger() having
      // already mutated state before detectDynamic snapshots. The
      // before/after check inside detectDynamic sees true→true (no
      // transition), but the presence comparison against ConditionState
      // must still detect the change.
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
        trigger: vi.fn(),
      });
      manager.addProblem(problem);

      manager.trigger('config_error', { error: new Error('cfg') });

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        problems: new Set(['config_error']),
      });
      expect(api.getCardElementManager().update).toBeCalled();
    });
  });

  describe('retry', () => {
    it('should call retry on the manager and reset the timer', () => {
      const { manager, problem } = createRetriableSetup();

      // Start the timer via evaluate, then immediately retry.
      manager.evaluate();
      manager.retry('media_load');

      expect(problem.retry).toBeCalled();

      // Timer should have been reset — advancing less than retrySeconds
      // should not fire it again.
      assert(problem.retry);
      vi.mocked(problem.retry).mockClear();
      vi.advanceTimersByTime(500);
      expect(problem.retry).not.toBeCalled();
    });

    it('should force retry even when needsRetry is false', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      const manager = new ProblemManager(api);
      const problem = createProblem('media_load', {
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addProblem(problem);

      manager.retry('media_load', true);

      expect(problem.retry).toBeCalled();
    });
  });

  describe('evaluate', () => {
    it('should update condition state and card when presence differs from state', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
      });
      manager.addProblem(problem);

      manager.evaluate();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        problems: new Set(['config_error']),
      });
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('should sync presence to condition state without update when unchanged', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error');
      manager.addProblem(problem);

      manager.evaluate();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        problems: new Set(),
      });
      expect(api.getCardElementManager().update).not.toBeCalled();
    });

    it('should trigger evaluate from listener on condition state manager', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addProblem(problem);

      stateManager.setState({ view: 'live' });

      expect(problem.detectDynamic).toBeCalled();
    });

    it('should not re-enter evaluate when setState triggers listener', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addProblem(problem);

      // Calling evaluate() will call setState() on the real
      // ConditionStateManager, which fires listeners synchronously. The
      // reentrancy guard must prevent detectDynamic from running twice.
      manager.evaluate();

      expect(problem.detectDynamic).toBeCalledTimes(1);
    });
  });

  describe('showNotification', () => {
    it('should call setNotification when a notification is available', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      const manager = new ProblemManager(api);

      const notification = { body: { text: 'test notification' } };
      const problem = createProblem('media_query', {
        getNotification: vi.fn().mockReturnValue(notification),
      });
      manager.addProblem(problem);

      manager.showNotification('media_query');

      expect(api.getNotificationManager().setNotification).toBeCalledWith(notification);
    });

    it('should not call setNotification when no notification exists for key', () => {
      const manager = new ProblemManager(createCardAPI());

      manager.showNotification('initialization');

      expect(createCardAPI().getNotificationManager().setNotification).not.toBeCalled();
    });
  });

  describe('scheduled retries', () => {
    it('should not schedule a retry when no problem wants retry', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error');
      manager.addProblem(problem);

      manager.evaluate();
      vi.runAllTimers();

      expect(api.getViewManager().setViewWithMergedContext).not.toBeCalled();
    });

    it('should not schedule a retry when config is null', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

      const manager = new ProblemManager(api);

      const problem = createProblem('media_load', {
        hasProblem: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
        needsRetry: vi.fn().mockReturnValue(true),
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addProblem(problem);

      manager.evaluate();
      vi.runAllTimers();

      expect(problem.retry).not.toBeCalled();
    });

    it('should not schedule a retry when retry_seconds is 0', () => {
      const { problem } = createRetriableSetup({ retrySeconds: 0 });

      vi.runAllTimers();

      expect(problem.retry).not.toBeCalled();
    });

    it('should schedule a retry when a problem wants retry and retry_seconds > 0', () => {
      const { manager, problem } = createRetriableSetup({ retrySeconds: 5 });

      manager.evaluate();
      vi.advanceTimersByTime(5000);

      expect(problem.retry).toBeCalled();
    });

    it('should call retry on the problem when the timer fires', () => {
      const { manager, problem } = createRetriableSetup();

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(problem.retry).toBeCalled();
    });

    it('should not schedule a second timer if one is already running', () => {
      const { manager, problem } = createRetriableSetup({ retrySeconds: 10 });

      manager.evaluate();
      manager.evaluate();

      vi.advanceTimersByTime(10000);

      expect(problem.retry).toBeCalledTimes(1);
    });

    it('should stop repeated timer when needsRetry becomes false', () => {
      const { manager, problem } = createRetriableSetup();

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(problem.retry).toBeCalledTimes(1);

      assert(problem.needsRetry);
      vi.mocked(problem.needsRetry).mockReturnValue(false);
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(problem.retry).toBeCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(problem.retry).toBeCalledTimes(1);
    });

    it('should skip scheduled retry when user is interacting and mode is inactive', () => {
      const { manager, problem } = createRetriableSetup({
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(problem.retry).not.toBeCalled();
    });

    it('should allow scheduled retry when user is not interacting and mode is inactive', () => {
      const { manager, problem } = createRetriableSetup({
        hasInteraction: false,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(problem.retry).toBeCalled();
    });

    it('should allow scheduled retry when mode is all regardless of interaction', () => {
      const { manager, problem } = createRetriableSetup({
        interactionMode: 'all',
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(problem.retry).toBeCalled();
    });

    it('should retry on next interval after interaction ends', () => {
      const { api, manager, problem } = createRetriableSetup({
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(problem.retry).not.toBeCalled();

      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(problem.retry).toBeCalled();
    });
  });

  describe('reset', () => {
    it('should reset a specific problem and re-evaluate', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new ProblemManager(api);

      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
        reset: vi.fn(),
      });
      manager.addProblem(problem);

      manager.reset('config_error');

      expect(problem.reset).toBeCalled();
    });

    it('should skip reset when targeted key has no active problem', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new ProblemManager(api);

      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(false),
        detectDynamic: vi.fn(),
        reset: vi.fn(),
      });
      manager.addProblem(problem);

      manager.reset('config_error');

      expect(problem.reset).not.toBeCalled();
      expect(problem.detectDynamic).not.toBeCalled();
    });
  });

  describe('suspend / resume', () => {
    it('should stop the retry timer on suspend', () => {
      const { manager, problem } = createRetriableSetup({ retrySeconds: 5 });

      manager.evaluate();
      manager.suspend();

      vi.advanceTimersByTime(5000);

      expect(problem.retry).not.toBeCalled();
    });

    it('should gate evaluate while suspended', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addProblem(problem);

      manager.suspend();
      manager.evaluate();

      expect(problem.detectDynamic).not.toBeCalled();
    });

    it('should preserve problem state across suspend', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
      });
      manager.addProblem(problem);

      manager.suspend();

      expect(manager.getStateManager().getProblemPresence().has('config_error')).toBe(
        true,
      );
    });

    it('should resume evaluation on resume', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new ProblemManager(api);
      const problem = createProblem('config_error', {
        hasProblem: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addProblem(problem);

      manager.suspend();
      manager.resume();

      expect(problem.detectDynamic).toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();
    });

    // Problem-internal timers (e.g. media_load) can still mutate state while
    // suspended because the gate is on manager evaluation, not on
    // individual problem callbacks. This is acceptable: on resume, evaluate()
    // surfaces the stale problem, and a subsequent successful media load
    // clears it via detectDynamic. This test documents that contract.
    it('should surface problem that matured during suspension after resume', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new ProblemManager(api);

      // Simulate a problem that activates its own state during suspension
      // (e.g. a timer callback setting _problemActive = true).
      const problem = createProblem('media_load', {
        hasProblem: vi.fn().mockReturnValue(false),
      });
      manager.addProblem(problem);

      manager.suspend();

      // Problem matures while suspended.
      vi.mocked(problem.hasProblem).mockReturnValue(true);

      // evaluate() is gated — no update.
      manager.evaluate();
      expect(api.getCardElementManager().update).not.toBeCalled();

      // On resume, the matured problem surfaces.
      manager.resume();
      expect(api.getCardElementManager().update).toBeCalled();

      // A subsequent state change that resolves the problem clears it.
      vi.mocked(problem.hasProblem).mockReturnValue(false);
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);
      manager.evaluate();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        problems: new Set(),
      });
    });
  });

  describe('destroy', () => {
    it('should stop the retry timer and destroy the manager', () => {
      const { manager, problem } = createRetriableSetup({ retrySeconds: 5 });
      assert(problem.reset);

      manager.evaluate();
      manager.destroy();

      vi.advanceTimersByTime(5000);

      expect(problem.retry).not.toBeCalled();
      expect(problem.reset).toBeCalled();
    });
  });
});
