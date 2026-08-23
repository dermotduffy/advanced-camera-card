// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CardController } from '../../../src/card-controller/controller';
import {
  IssueManager,
  RETRY_EXPONENTIAL_BASE_SECONDS,
  RETRY_EXPONENTIAL_MAX_SECONDS,
} from '../../../src/card-controller/issues/issue-manager';
import { MediaUnavailableIssue } from '../../../src/card-controller/issues/issues/media-unavailable';
import { createRetryControl } from '../../../src/card-controller/issues/retry-control';
import type {
  Issue,
  IssueDescription,
  IssueKey,
} from '../../../src/card-controller/issues/types';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import type { InteractionMode } from '../../../src/config/schema/view';
import { createConfig } from '../../config/test-utils';
import {
  createCardAPI,
  createHASS,
  createMediaLoadedInfo,
  flushPromises,
} from '../../test-utils';
import { createView } from '../../view/test-utils';

const DEFAULT_RETRY_SECONDS = 1;

const createIssue = (key: IssueKey, overrides?: Partial<Issue>): Issue =>
  mock({
    key,
    hasIssue: vi.fn().mockReturnValue(false),
    getIssue: vi.fn().mockReturnValue(null),
    needsRetry: vi.fn().mockReturnValue(false),
    ...overrides,
  });

const createIssueDescription = (
  overrides?: Partial<IssueDescription>,
): IssueDescription => ({
  icon: 'mdi:alert',
  severity: 'high',
  notification: { body: { text: 'test' } },
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

  const issue = createIssue('media_unavailable', {
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

    expect(issue.detectDynamic).toHaveBeenCalled();
  });

  it('should keep a liveness-triggered error active while its media still reads as loaded', () => {
    // Regression: a runtime liveness loss (stall / provider error) fires a
    // trigger while the (now frozen) media is still loaded. The trigger's
    // synchronous evaluate must not clear the just-set error via the stale
    // loaded state.
    const api = createCardAPI();
    const conditionStateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(conditionStateManager);
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ view: 'live', camera: 'camera.office' }),
    );

    const manager = new IssueManager(api);
    const issue = new MediaUnavailableIssue(api);
    manager.addIssue(issue);

    conditionStateManager.setState({
      view: 'live',
      targetID: 'camera.office',
      mediaLoadedInfo: createMediaLoadedInfo({ targetID: 'camera.office' }),
    });
    expect(issue.hasIssue()).toBe(false);

    manager.trigger('media_unavailable', {
      targetID: 'camera.office',
      reason: 'stalled',
    });

    expect(issue.hasIssue()).toBe(true);
    expect(issue.needsRetry()).toBe(true);
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

  describe('static detection via condition-state listener', () => {
    it('should run static detection when mandatory init completes', async () => {
      const api = createCardAPI();
      const conditionStateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(conditionStateManager);

      const manager = new IssueManager(api);
      const detectStatic = vi.fn().mockResolvedValue(undefined);
      const issue = createIssue('legacy_resource', { detectStatic });
      manager.addIssue(issue);

      const hass = createHASS();
      conditionStateManager.setState({ hass });
      conditionStateManager.setState({ initialized: true, everInitialized: true });
      await flushPromises();

      expect(detectStatic).toHaveBeenCalledWith(hass);
    });

    it('should run static detection once regardless how often the card initializes', async () => {
      const api = createCardAPI();
      const conditionStateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(conditionStateManager);

      const manager = new IssueManager(api);
      const detectStatic = vi.fn().mockResolvedValue(undefined);
      const issue = createIssue('legacy_resource', { detectStatic });
      manager.addIssue(issue);

      conditionStateManager.setState({ hass: createHASS() });
      conditionStateManager.setState({ initialized: true, everInitialized: true });

      // The card gets disconnected/reconnected as it does on a dashboard tab
      // change. `everInitialized` is unchanged by that, so detection does not
      // run a second time.
      conditionStateManager.setState({ initialized: false });
      conditionStateManager.setState({ initialized: true, everInitialized: true });
      await flushPromises();

      expect(detectStatic).toHaveBeenCalledTimes(1);
    });

    it('should not run static detection when hass is unset', () => {
      const api = createCardAPI();
      const conditionStateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(conditionStateManager);

      const manager = new IssueManager(api);
      const detectStatic = vi.fn().mockResolvedValue(undefined);
      const issue = createIssue('legacy_resource', { detectStatic });
      manager.addIssue(issue);

      conditionStateManager.setState({ initialized: true, everInitialized: true });

      expect(detectStatic).not.toHaveBeenCalled();
    });

    it('should not run static detection on unrelated state changes', () => {
      const api = createCardAPI();
      const conditionStateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(conditionStateManager);

      const manager = new IssueManager(api);
      const detectStatic = vi.fn().mockResolvedValue(undefined);
      const issue = createIssue('legacy_resource', { detectStatic });
      manager.addIssue(issue);

      const hass = createHASS();
      conditionStateManager.setState({ hass });
      conditionStateManager.setState({ view: 'live' });

      expect(detectStatic).not.toHaveBeenCalled();
    });
  });

  describe('trigger', () => {
    it('should trigger the issue and call evaluate', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);

      const issue = createIssue('config_error', {
        trigger: vi.fn(),
      });
      manager.addIssue(issue);

      manager.trigger('config_error', { error: new Error('cfg') });

      expect(issue.trigger).toHaveBeenCalledWith({ error: expect.any(Error) });
    });

    it('should update the card even when state was mutated before detectDynamic', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);

      // hasIssue returns true from the start -- simulates trigger() having
      // already mutated state before detectDynamic snapshots. The before/after
      // check inside detectDynamic sees true→true (no transition), but the
      // presence comparison against the last evaluation must still detect the
      // change.
      const description = createIssueDescription();
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(description),
        trigger: vi.fn(),
      });
      manager.addIssue(issue);

      manager.trigger('config_error', { error: new Error('cfg') });

      expect(api.getCardElementManager().update).toHaveBeenCalled();
    });

    it('should never auto-popup on trigger -- non-full-card issues surface via the status-bar icon; user clicks to open', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);

      const issue = createIssue('view_incompatible', {
        hasIssue: vi.fn().mockReturnValue(true),
        isFullCardIssue: vi.fn().mockReturnValue(false),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
        getNotification: vi.fn().mockReturnValue({ body: { text: 'noop' } }),
        trigger: vi.fn(),
      });
      manager.addIssue(issue);

      manager.trigger('view_incompatible', { error: new Error('mismatch') });

      expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('should resolve the issue and update the card once it clears', () => {
      const api = createCardAPI();
      const manager = new IssueManager(api);

      const issue = createIssue('media_unavailable', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
        resolve: vi.fn(),
      });
      manager.addIssue(issue);

      // Establish the issue as present, then let resolving remove it.
      manager.evaluate();
      vi.mocked(api.getCardElementManager().update).mockClear();
      vi.mocked(issue.getIssue).mockReturnValue(null);

      manager.resolve('media_unavailable', { targetID: 'camera-1' });

      expect(issue.resolve).toHaveBeenCalledWith({ targetID: 'camera-1' });
      expect(api.getCardElementManager().update).toHaveBeenCalled();
    });

    it('should stop retrying once resolve removes the last retryable problem', () => {
      const { manager, issue } = createRetriableSetup();
      assert(issue.resolve);
      assert(issue.needsRetry);

      // Arm the retry timer while the problem is unresolved.
      manager.evaluate();

      vi.mocked(issue.needsRetry).mockReturnValue(false);
      manager.resolve('media_unavailable', { targetID: 'camera-1' });

      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000 * 10);
      expect(issue.retry).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('should call retry on the manager and reset the timer', () => {
      const { manager, issue } = createRetriableSetup();

      // Start the timer via evaluate, then immediately retry.
      manager.evaluate();
      manager.retry('media_unavailable');

      expect(issue.retry).toHaveBeenCalled();

      // Timer should have been reset -- advancing less than retrySeconds should
      // not fire it again.
      assert(issue.retry);
      vi.mocked(issue.retry).mockClear();
      vi.advanceTimersByTime(500);
      expect(issue.retry).not.toHaveBeenCalled();
    });

    it('should force retry even when needsRetry is false', () => {
      const api = createCardAPI();
      const manager = new IssueManager(api);
      const issue = createIssue('media_unavailable', {
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addIssue(issue);

      manager.retry('media_unavailable', true);

      expect(issue.retry).toHaveBeenCalled();
    });
  });

  describe('evaluate', () => {
    it('should update the card when presence differs from the last evaluation', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const description = createIssueDescription();
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(description),
      });
      manager.addIssue(issue);

      manager.evaluate();

      expect(api.getCardElementManager().update).toHaveBeenCalled();
    });

    it('should not write issue presence back into the condition state', () => {
      // Locks in the fix: routing issue presence through ConditionState (which
      // embeds churning callback closures) is what caused the re-render loop.
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
      });
      manager.addIssue(issue);

      manager.evaluate();

      expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();
    });

    it('should not update the card when there are no issues', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('config_error');
      manager.addIssue(issue);

      manager.evaluate();

      expect(api.getCardElementManager().update).not.toHaveBeenCalled();
    });

    it('should call update when an active issue swaps sub-states without changing the key set', () => {
      // Simulates ConnectionIssue going from 'lost' to 'starting': the presence
      // key set ({connection}) is identical, but the description value differs.
      // Because IssuePresence is a Map<key, description>, the presence diff sees
      // the value-level change and requests a re-render.
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const getIssue = vi
        .fn()
        .mockReturnValue(
          createIssueDescription({ notification: { body: { text: 'lost' } } }),
        );
      const issue = createIssue('connection', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue,
      });
      manager.addIssue(issue);

      manager.evaluate();
      vi.mocked(api.getCardElementManager().update).mockClear();

      // Same key set ({connection}), different description value.
      getIssue.mockReturnValue(
        createIssueDescription({ notification: { body: { text: 'starting' } } }),
      );
      manager.evaluate();

      expect(api.getCardElementManager().update).toHaveBeenCalled();
    });

    it('should not call update when content is identical across evaluations', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('connection', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
      });
      manager.addIssue(issue);

      manager.evaluate();
      vi.mocked(api.getCardElementManager().update).mockClear();

      // Re-evaluate without any change.
      manager.evaluate();

      expect(api.getCardElementManager().update).not.toHaveBeenCalled();
    });

    it('should not request repeated updates as retry callback closures churn', () => {
      // Regression: getIssuePresence() rebuilds notifications fresh each call,
      // so a retry control embeds a new callback closure every evaluation. The
      // presence diff must ignore that function-identity churn, otherwise every
      // evaluation looks changed and the card re-renders endlessly.
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('media_unavailable', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockImplementation(() =>
          createIssueDescription({
            notification: {
              controls: [createRetryControl('media_unavailable')],
            },
          }),
        ),
      });
      manager.addIssue(issue);

      manager.evaluate();
      vi.mocked(api.getCardElementManager().update).mockClear();

      manager.evaluate();

      expect(api.getCardElementManager().update).not.toHaveBeenCalled();
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

      expect(issue.detectDynamic).toHaveBeenCalled();
    });
  });

  describe('showNotification', () => {
    it('should call setNotification when a notification is available', () => {
      const api = createCardAPI();
      const manager = new IssueManager(api);

      const notification = { body: { text: 'test notification' } };
      const issue = createIssue('media_query', {
        getNotification: vi.fn().mockReturnValue(notification),
      });
      manager.addIssue(issue);

      manager.showNotification('media_query');

      expect(api.getNotificationManager().setNotification).toHaveBeenCalledWith(
        notification,
      );
    });

    it('should not call setNotification when no notification exists for key', () => {
      const manager = new IssueManager(createCardAPI());

      manager.showNotification('initialization');

      expect(
        createCardAPI().getNotificationManager().setNotification,
      ).not.toHaveBeenCalled();
    });
  });

  describe('scheduled retries', () => {
    it('should not schedule a retry when no issue wants retry', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const manager = new IssueManager(api);
      const issue = createIssue('config_error');
      manager.addIssue(issue);

      manager.evaluate();
      vi.runAllTimers();

      expect(api.getViewManager().setViewWithMergedContext).not.toHaveBeenCalled();
    });

    it('should not schedule a retry when config is null', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

      const manager = new IssueManager(api);

      const issue = createIssue('media_unavailable', {
        hasIssue: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
        needsRetry: vi.fn().mockReturnValue(true),
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addIssue(issue);

      manager.evaluate();
      vi.runAllTimers();

      expect(issue.retry).not.toHaveBeenCalled();
    });

    it('should not schedule a retry when retry_seconds is 0', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 0 });

      manager.evaluate();
      vi.runAllTimers();

      expect(issue.retry).not.toHaveBeenCalled();
    });

    it('should schedule a retry when an issue wants retry and retry_seconds > 0', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 5 });

      manager.evaluate();
      vi.advanceTimersByTime(5000);

      expect(issue.retry).toHaveBeenCalled();
    });

    it('should call retry on the issue when the timer fires', () => {
      const { manager, issue } = createRetriableSetup();

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toHaveBeenCalled();
    });

    it('should not schedule a second timer if one is already running', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 10 });

      manager.evaluate();
      manager.evaluate();

      vi.advanceTimersByTime(10000);

      expect(issue.retry).toHaveBeenCalledTimes(1);
    });

    it('should stop repeated timer when needsRetry becomes false', () => {
      const { manager, issue } = createRetriableSetup();

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(1);

      assert(issue.needsRetry);
      vi.mocked(issue.needsRetry).mockReturnValue(false);
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(issue.retry).toHaveBeenCalledTimes(1);
    });

    it('should skip scheduled retry when user is interacting and mode is inactive', () => {
      const { manager, issue } = createRetriableSetup({
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).not.toHaveBeenCalled();
    });

    it('should allow scheduled retry when user is not interacting and mode is inactive', () => {
      const { manager, issue } = createRetriableSetup({
        hasInteraction: false,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toHaveBeenCalled();
    });

    it('should allow scheduled retry when mode is all regardless of interaction', () => {
      const { manager, issue } = createRetriableSetup({
        interactionMode: 'all',
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);

      expect(issue.retry).toHaveBeenCalled();
    });

    it('should retry on next interval after interaction ends', () => {
      const { api, manager, issue } = createRetriableSetup({
        hasInteraction: true,
      });

      manager.evaluate();
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(issue.retry).not.toHaveBeenCalled();

      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.advanceTimersByTime(DEFAULT_RETRY_SECONDS * 1000);
      expect(issue.retry).toHaveBeenCalled();
    });
  });

  describe('auto retry (exponential backoff)', () => {
    it('should schedule the first retry within the 15s–30s jitter range', () => {
      // Math.random returns 0 → jitter = 0.5 → delay = base * 0.5 = 15s.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.5 * 1000 - 1);
      expect(issue.retry).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(issue.retry).toHaveBeenCalledTimes(1);
    });

    it('should schedule the first retry at the upper bound when jitter is max', () => {
      // Math.random returns 1 → jitter = 1.0 → delay = base * 1.0 = 30s.
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 1.0 * 1000 - 1);
      expect(issue.retry).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(issue.retry).toHaveBeenCalledTimes(1);
    });

    it('should double the base delay on each successive attempt', () => {
      // Math.random returns 0.5 → jitter = 0.75 → delays: 22.5, 45, 90 seconds.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 4 * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(3);
    });

    it('should cap the backoff at the max delay', () => {
      // Drive attempts through the exponential region (base, base*2, base*4,
      // ...) until the delay reaches MAX, then assert the next attempt clamps to
      // MAX instead of continuing to double, and stays there.
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      let attempts = 0;
      for (
        let delaySeconds = RETRY_EXPONENTIAL_BASE_SECONDS;
        delaySeconds < RETRY_EXPONENTIAL_MAX_SECONDS;
        delaySeconds *= 2
      ) {
        vi.advanceTimersByTime(delaySeconds * 1000);
        attempts++;
      }
      expect(issue.retry).toHaveBeenCalledTimes(attempts);

      // The next attempt clamps to MAX instead of the would-be larger delay.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_MAX_SECONDS * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(attempts + 1);

      // And it stays capped at MAX rather than growing further.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_MAX_SECONDS * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(attempts + 2);
    });

    it('should reset the attempt counter when the issue clears', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { manager, issue } = createRetriableSetup({ retrySeconds: 'auto' });
      manager.evaluate();

      // Run two retries -- second delay should be 2x the first.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(2);

      // Clear the issue: needsRetry returns false. The next timer fire sees
      // it cleared and resets the attempt counter.
      assert(issue.needsRetry);
      vi.mocked(issue.needsRetry).mockReturnValue(false);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 4 * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(2);

      // Re-arm: needsRetry returns true again, evaluate to re-schedule.
      vi.mocked(issue.needsRetry).mockReturnValue(true);
      manager.evaluate();

      // Next delay should be back at the base (attempt 0), not continuing
      // from where we left off.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(3);
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

      // Three gated firings -- each at the base delay (22.5s with 0.75 jitter).
      // If the counter were incrementing on gated fires, the second would be at
      // 45s and we'd never reach it after only 22.5s.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).not.toHaveBeenCalled();

      // Clear the interaction. The next firing -- still at the base delay -- is
      // now allowed and the retry runs.
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(1);
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
      expect(issue.retry).toHaveBeenCalledTimes(2);

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
      expect(issue.retry).toHaveBeenCalledTimes(3);

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
      expect(issue.retry).toHaveBeenCalledTimes(4);
    });
  });

  describe('in-flight retry', () => {
    it('should hold the backoff and not arm a timer while a retry is in flight', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const api = createCardAPI();
      const config = createConfig();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue({
        ...config,
        view: {
          ...config.view,
          issues: { interaction_mode: 'all', retry_seconds: 'auto' },
        },
      });
      const manager = new IssueManager(api);

      const canRetryNow = vi.fn().mockReturnValue(true);
      const issue = createIssue('media_query', {
        hasIssue: vi.fn().mockReturnValue(true),
        needsRetry: vi.fn().mockReturnValue(true),
        canRetryNow,
        retry: vi.fn().mockReturnValue(false),
      });
      manager.addIssue(issue);

      manager.evaluate();

      // First attempt fires at the base delay, advancing the backoff to
      // attempt 1.
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(1);

      // The attempt is now in flight: the problem is still unresolved
      // (needsRetry) but cannot be retried right now (canRetryNow). The running
      // timer is canceled and no further attempt fires, however long we wait.
      canRetryNow.mockReturnValue(false);
      manager.evaluate();
      vi.advanceTimersByTime(RETRY_EXPONENTIAL_MAX_SECONDS * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(1);

      // The attempt fails and becomes retryable again. Because the backoff was
      // preserved, the next delay is the attempt-1 step (base*2), not base.
      canRetryNow.mockReturnValue(true);
      manager.evaluate();

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(RETRY_EXPONENTIAL_BASE_SECONDS * 2 * 0.75 * 1000);
      expect(issue.retry).toHaveBeenCalledTimes(2);
    });
  });

  describe('reset', () => {
    it('should reset a specific issue and re-evaluate', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);

      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
        reset: vi.fn(),
      });
      manager.addIssue(issue);

      manager.reset('config_error');

      expect(issue.reset).toHaveBeenCalled();
    });

    it('should skip reset when targeted key has no active issue', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);

      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(false),
        detectDynamic: vi.fn(),
        reset: vi.fn(),
      });
      manager.addIssue(issue);

      manager.reset('config_error');

      expect(issue.reset).not.toHaveBeenCalled();
      expect(issue.detectDynamic).not.toHaveBeenCalled();
    });
  });

  describe('suspend / resume', () => {
    it('should stop the retry timer on suspend', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 5 });

      manager.evaluate();
      manager.suspend();

      vi.advanceTimersByTime(5000);

      expect(issue.retry).not.toHaveBeenCalled();
    });

    it('should gate evaluate while suspended', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        detectDynamic: vi.fn(),
      });
      manager.addIssue(issue);

      manager.suspend();
      manager.evaluate();

      expect(issue.detectDynamic).not.toHaveBeenCalled();
    });

    it('should preserve issue state across suspend', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
      });
      manager.addIssue(issue);

      manager.suspend();

      expect(manager.getStateManager().getIssuePresence().has('config_error')).toBe(
        true,
      );
    });

    it('should resume evaluation on resume', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('config_error', {
        hasIssue: vi.fn().mockReturnValue(true),
        getIssue: vi.fn().mockReturnValue(createIssueDescription()),
        detectDynamic: vi.fn(),
      });
      manager.addIssue(issue);

      manager.suspend();
      manager.resume();

      expect(issue.detectDynamic).toHaveBeenCalled();
      expect(api.getCardElementManager().update).toHaveBeenCalled();
    });

    it('should invoke Issue.suspend on timer-backed issues when suspended', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      const issue = createIssue('media_unavailable', { suspend: vi.fn() });
      manager.addIssue(issue);

      manager.suspend();

      expect(issue.suspend).toHaveBeenCalled();
    });

    it('should tolerate issues without a suspend hook', () => {
      const api = createCardAPI();

      const manager = new IssueManager(api);
      // Plain Issue implementation -- no optional methods installed.
      const issue: Issue = {
        key: 'config_error',
        hasIssue: () => false,
        getIssue: () => null,
      };
      manager.addIssue(issue);

      // Must not throw.
      manager.suspend();
    });
  });

  describe('destroy', () => {
    it('should stop the retry timer and destroy the manager', () => {
      const { manager, issue } = createRetriableSetup({ retrySeconds: 5 });
      assert(issue.reset);

      manager.evaluate();
      manager.destroy();

      vi.advanceTimersByTime(5000);

      expect(issue.retry).not.toHaveBeenCalled();
      expect(issue.reset).toHaveBeenCalled();
    });
  });
});
