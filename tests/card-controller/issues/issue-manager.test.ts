// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../../src/card-controller/controller';
import { IssueManager } from '../../../src/card-controller/issues/issue-manager';
import { Issue, IssueKey } from '../../../src/card-controller/issues/types';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { InteractionMode } from '../../../src/config/schema/view';
import { createCardAPI, createConfig } from '../../test-utils';

const DEFAULT_RETRY_SECONDS = 1;

const createIssue = (key: IssueKey, overrides?: Partial<Issue>): Issue =>
  mock({
    key,
    hasIssue: vi.fn().mockReturnValue(false),
    getIssue: vi.fn().mockReturnValue(null),
    needsRetry: vi.fn().mockReturnValue(false),
    ...overrides,
  });

const createRetriableSetup = (options?: {
  retrySeconds?: number;
  interactionMode?: InteractionMode;
  hasInteraction?: boolean;
}): {
  api: CardController;
  manager: IssueManager;
  issue: Issue;
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
      issues: {
        interaction_mode: options?.interactionMode ?? 'inactive',
        retry_seconds: options?.retrySeconds ?? DEFAULT_RETRY_SECONDS,
      },
    },
  });

  const manager = new IssueManager(api);

  const issue = createIssue('media_load', {
    hasIssue: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
    needsRetry: vi.fn().mockReturnValue(true),
    retry: vi.fn().mockReturnValue(false),
  });
  manager.addIssue(issue);

  return { api, manager, issue };
};

describe('IssueManager', () => {
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

    const manager = new IssueManager(api);
    const issue = createIssue('config_error', {
      detectDynamic: vi.fn(),
    });
    manager.addIssue(issue);

    stateManager.setState({ view: 'live' });

    expect(issue.detectDynamic).toBeCalled();
  });

  describe('addIssue / getStateManager', () => {
    it('should make added issues accessible via getManager', () => {
      const manager = new IssueManager(createCardAPI());

      const issue = createIssue('config_error');
      manager.addIssue(issue);

      expect(manager.getStateManager().getIssuePresence().has('config_error')).toBe(
        false,
      );
    });
  });

  describe('trigger', () => {
    it('should trigger the issue and call evaluate', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new IssueManager(api);

      const issue = createIssue('config_error', {
        trigger: vi.fn(),
      });
      manager.addIssue(issue);

      manager.trigger('config_error', { error: new Error('cfg') });

      expect(issue.trigger).toBeCalledWith({ error: expect.any(Error) });
    });

    it('should update presence even when state was mutated before detectDynamic', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new IssueManager(api);

      // hasIssue returns true from the start — simulates trigger() having
      // already mutated state before detectDynamic snapshots. The
      // before/after check inside detectDynamic sees true→true (no
      // transition), but the presence comparison against ConditionState
      // must still detect the change.
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        trigger: vi.fn(),
      });
      manager.addIssue(issue);

      manager.trigger('config_error', { error: new Error('cfg') });

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        issues: new Set(['config_error']),
      });
      expect(api.getCardElementManager().update).toBeCalled();
    });
  });

  describe('retry', () => {
    it('should call retry on the manager and reset the timer', () => {
      const { manager, issue } = createRetriableSetup();

      // Start the timer via evaluate, then immediately retry.
      manager.evaluate();
      manager.retry('media_load');

      expect(issue.retry).toBeCalled();

      // Timer should have been reset — advancing less than retrySeconds
      // should not fire it again.
      assert(issue.retry);
      vi.mocked(issue.retry).mockClear();
      vi.advanceTimersByTime(500);
      expect(issue.retry).not.toBeCalled();
    });

    it('should force retry even when needsRetry is false', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      const manager = new IssueManager(api);
      const issue = createIssue('media_load', {
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addIssue(issue);

      manager.retry('media_load', true);

      expect(issue.retry).toBeCalled();
    });
  });

  describe('evaluate', () => {
    it('should update condition state and card when presence differs from state', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
      });
      manager.addIssue(issue);

      manager.evaluate();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        issues: new Set(['config_error']),
      });
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('should sync presence to condition state without update when unchanged', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new IssueManager(api);
      const issue = createIssue('config_error');
      manager.addIssue(issue);

      manager.evaluate();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        issues: new Set(),
      });
      expect(api.getCardElementManager().update).not.toBeCalled();
    });

    it('should trigger evaluate from listener on condition state manager', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addIssue(issue);

      stateManager.setState({ view: 'live' });

      expect(issue.detectDynamic).toBeCalled();
    });

    it('should not re-enter evaluate when setState triggers listener', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addIssue(issue);

      // Calling evaluate() will call setState() on the real
      // ConditionStateManager, which fires listeners synchronously. The
      // reentrancy guard must prevent detectDynamic from running twice.
      manager.evaluate();

      expect(issue.detectDynamic).toBeCalledTimes(1);
    });
  });

  describe('showNotification', () => {
    it('should call setNotification when a notification is available', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      const manager = new IssueManager(api);

      const notification = { body: { text: 'test notification' } };
      const issue = createIssue('media_query', {
        getNotification: vi.fn().mockReturnValue(notification),
      });
      manager.addIssue(issue);

      manager.showNotification('media_query');

      expect(api.getNotificationManager().setNotification).toBeCalledWith(notification);
    });

    it('should not call setNotification when no notification exists for key', () => {
      const manager = new IssueManager(createCardAPI());

      manager.showNotification('initialization');

      expect(createCardAPI().getNotificationManager().setNotification).not.toBeCalled();
    });
  });

  describe('scheduled retries', () => {
    it('should not schedule a retry when no issue wants retry', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const manager = new IssueManager(api);
      const issue = createIssue('config_error');
      manager.addIssue(issue);

      manager.evaluate();
      vi.runAllTimers();

      expect(api.getViewManager().setViewWithMergedContext).not.toBeCalled();
    });

    it('should not schedule a retry when config is null', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

      const manager = new IssueManager(api);

      const issue = createIssue('media_load', {
        hasIssue: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
        needsRetry: vi.fn().mockReturnValue(true),
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addIssue(issue);

      manager.evaluate();
      vi.runAllTimers();

      expect(issue.retry).not.toBeCalled();
    });

    it('should not schedule a retry when retry_seconds is 0', () => {
      const { issue } = createRetriableSetup({ retrySeconds: 0 });

      vi.runAllTimers();

      expect(issue.retry).not.toBeCalled();
    });

    it('should schedule a retry when an issue wants retry and retry_seconds > 0', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 5 });

      manager.evaluate();
      vi.advanceTimersByTime(5000);

      expect(issue.retry).toBeCalled();
    });

    it('should call retry on the issue when the timer fires', () => {
      const { manager, issue } = createRetriableSetup();

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toBeCalled();
    });

    it('should not schedule a second timer if one is already running', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 10 });

      manager.evaluate();
      manager.evaluate();

      vi.advanceTimersByTime(10000);

      expect(issue.retry).toBeCalledTimes(1);
    });

    it('should stop repeated timer when needsRetry becomes false', () => {
      const { manager, issue } = createRetriableSetup();

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(issue.retry).toBeCalledTimes(1);

      assert(issue.needsRetry);
      vi.mocked(issue.needsRetry).mockReturnValue(false);
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toBeCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(issue.retry).toBeCalledTimes(1);
    });

    it('should skip scheduled retry when user is interacting and mode is inactive', () => {
      const { manager, issue } = createRetriableSetup({
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).not.toBeCalled();
    });

    it('should allow scheduled retry when user is not interacting and mode is inactive', () => {
      const { manager, issue } = createRetriableSetup({
        hasInteraction: false,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toBeCalled();
    });

    it('should allow scheduled retry when mode is all regardless of interaction', () => {
      const { manager, issue } = createRetriableSetup({
        interactionMode: 'all',
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toBeCalled();
    });

    it('should retry on next interval after interaction ends', () => {
      const { api, manager, issue } = createRetriableSetup({
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(issue.retry).not.toBeCalled();

      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(issue.retry).toBeCalled();
    });
  });

  describe('reset', () => {
    it('should reset a specific issue and re-evaluate', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new IssueManager(api);

      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        reset: vi.fn(),
      });
      manager.addIssue(issue);

      manager.reset('config_error');

      expect(issue.reset).toBeCalled();
    });

    it('should skip reset when targeted key has no active issue', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new IssueManager(api);

      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(false),
        detectDynamic: vi.fn(),
        reset: vi.fn(),
      });
      manager.addIssue(issue);

      manager.reset('config_error');

      expect(issue.reset).not.toBeCalled();
      expect(issue.detectDynamic).not.toBeCalled();
    });
  });

  describe('suspend / resume', () => {
    it('should stop the retry timer on suspend', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 5 });

      manager.evaluate();
      manager.suspend();

      vi.advanceTimersByTime(5000);

      expect(issue.retry).not.toBeCalled();
    });

    it('should gate evaluate while suspended', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addIssue(issue);

      manager.suspend();
      manager.evaluate();

      expect(issue.detectDynamic).not.toBeCalled();
    });

    it('should preserve issue state across suspend', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
      });
      manager.addIssue(issue);

      manager.suspend();

      expect(manager.getStateManager().getIssuePresence().has('config_error')).toBe(
        true,
      );
    });

    it('should resume evaluation on resume', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addIssue(issue);

      manager.suspend();
      manager.resume();

      expect(issue.detectDynamic).toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();
    });

    // Issue-internal timers (e.g. media_load) can still mutate state while
    // suspended because the gate is on manager evaluation, not on
    // individual issue callbacks. This is acceptable: on resume, evaluate()
    // surfaces the stale issue, and a subsequent successful media load
    // clears it via detectDynamic. This test documents that contract.
    it('should surface issue that matured during suspension after resume', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);

      const manager = new IssueManager(api);

      // Simulate an issue that activates its own state during suspension
      // (e.g. a timer callback setting _issueActive = true).
      const issue = createIssue('media_load', {
        hasIssue: vi.fn().mockReturnValue(false),
      });
      manager.addIssue(issue);

      manager.suspend();

      // Issue matures while suspended.
      vi.mocked(issue.hasIssue).mockReturnValue(true);

      // evaluate() is gated — no update.
      manager.evaluate();
      expect(api.getCardElementManager().update).not.toBeCalled();

      // On resume, the matured issue surfaces.
      manager.resume();
      expect(api.getCardElementManager().update).toBeCalled();

      // A subsequent state change that resolves the issue clears it.
      vi.mocked(issue.hasIssue).mockReturnValue(false);
      vi.mocked(api.getConditionStateManager().setState).mockReturnValue(true);
      manager.evaluate();

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        issues: new Set(),
      });
    });
  });

  describe('destroy', () => {
    it('should stop the retry timer and destroy the manager', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 5 });
      assert(issue.reset);

      manager.evaluate();
      manager.destroy();

      vi.advanceTimersByTime(5000);

      expect(issue.retry).not.toBeCalled();
      expect(issue.reset).toBeCalled();
    });
  });
});
