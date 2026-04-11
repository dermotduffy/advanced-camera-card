// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../../src/card-controller/controller';
import {
  IssueManager,
  RETRY_EXPONENTIAL_BASE_SECONDS,
  RETRY_EXPONENTIAL_MAX_SECONDS,
} from '../../../src/card-controller/issues/issue-manager';
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
  retrySeconds?: 'auto' | number;
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
    vi.restoreAllMocks();
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
      const { manager, issue } = createRetriableSetup({ retrySeconds: 0 });

      manager.evaluate();
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

  describe('auto retry (exponential backoff)', () => {
    it('should schedule the first retry within the 15s–30s jitter range', () => {
      // Math.random returns 0 → jitter = 0.5 → delay = base * 0.5 = 15s.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.5 * 1000 - 1);
      expect(issue.retry).not.toBeCalled();

      vi.advanceTimersByTime(1);
      expect(issue.retry).toBeCalledTimes(1);
    });

    it('should schedule the first retry at the upper bound when jitter is max', () => {
      // Math.random returns 1 → jitter = 1.0 → delay = base * 1.0 = 30s.
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 1.0 * 1000 - 1);
      expect(issue.retry).not.toBeCalled();

      vi.advanceTimersByTime(1);
      expect(issue.retry).toBeCalledTimes(1);
    });

    it('should double the base delay on each successive attempt', () => {
      // Math.random returns 0.5 → jitter = 0.75 → delays: 22.5, 45, 90 seconds.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(1);

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(2);

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 4 * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(3);
    });

    it('should cap the backoff at the max delay', () => {
      // Drive 5 pre-cap attempts (30, 60, 120, 240, 480 seconds), then assert
      // the 6th attempt clamps to MAX instead of the would-be 960.
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 1 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 4 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 8 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 16 * 1000);
      expect(issue.retry).toBeCalledTimes(5);

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_MAX_SECONDS * 1000);
      expect(issue.retry).toBeCalledTimes(6);
    });

    it('should reset the attempt counter when the issue clears', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      // Run two retries — second delay should be 2x the first.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(2);

      // Clear the issue: needsRetry returns false. The next timer fire sees
      // it cleared and resets the attempt counter.
      assert(issue.needsRetry);
      vi.mocked(issue.needsRetry).mockReturnValue(false);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 4 * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(2);

      // Re-arm: needsRetry returns true again, evaluate to re-schedule.
      vi.mocked(issue.needsRetry).mockReturnValue(true);
      manager.evaluate();

      // Next delay should be back at the base (attempt 0), not continuing
      // from where we left off.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(3);
    });

    it('should not grow the delay while retries are gated by user interaction', () => {
      // Auto mode + interaction gating: when the timer fires while the user
      // is interacting, the retry is skipped (not counted as an attempt) and
      // the timer re-arms at the *same* delay, not the next exponential step.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { api, manager, issue } = createRetriableSetup({
        retrySeconds: 'auto',
        hasInteraction: true,
      });
      manager.evaluate();

      // Three gated firings — each at the base delay (22.5s with 0.75 jitter).
      // If the counter were incrementing on gated fires, the second would be
      // at 45s and we'd never reach it after only 22.5s.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).not.toBeCalled();

      // Clear the interaction. The next firing — still at the base delay —
      // is now allowed and the retry runs.
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(1);
    });

    it('should reset the attempt counter when retries are disabled and re-enabled', () => {
      // Drive auto-mode retries to push _retryAttempt > 0, then disable
      // retries (retry_seconds=0) and re-enable. The next retry must fire at
      // the base delay, not at the inflated delay the prior counter implies.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { api, manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(2);

      // Disable retries via config.
      const config = createConfig();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue({
        ...config,
        view: {
          ...config.view,
          issues: { interaction_mode: 'inactive', retry_seconds: 0 },
        },
      });

      // Let the pending timer fire. The retry runs (#3), then evaluate sees
      // retry_seconds=0 and resets _retryAttempt.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 4 * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(3);

      // Re-enable.
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue({
        ...config,
        view: {
          ...config.view,
          issues: { interaction_mode: 'inactive', retry_seconds: 'auto' },
        },
      });
      manager.evaluate();

      // Without the reset, _retryAttempt would be 3 here, making the next
      // delay BASE * 8 * 0.75 = 180s. With the reset, it's BASE * 0.75 = 22.5s,
      // so advancing only the base interval triggers the next retry.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toBeCalledTimes(4);
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
