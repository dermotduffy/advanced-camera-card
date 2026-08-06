// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createIssueManager } from '../../../src/card-controller/issues/factory';
import { IssueManager } from '../../../src/card-controller/issues/issue-manager';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createCardAPI } from '../../test-utils';
import { createView } from '../../view/test-utils';
import { createSubscriptionHealth } from '../test-utils';

describe('createIssueManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a IssueManager instance', () => {
    const manager = createIssueManager(createCardAPI(), createSubscriptionHealth());
    expect(manager).toBeInstanceOf(IssueManager);
  });

  it('should register all expected issues', () => {
    const manager = createIssueManager(
      createCardAPI(),
      createSubscriptionHealth(),
    ).getStateManager();

    expect(manager.getIssueDescriptions()).toHaveLength(0);

    const expectedKeys = [
      'config_error',
      'config_upgrade',
      'config_upgrade_failure',
      'connection',
      'event_subscription',
      'initialization',
      'legacy_resource',
      'media_query',
      'media_unavailable',
      'view_incompatible',
    ] as const;

    for (const key of expectedKeys) {
      expect(() => manager.getNotification(key)).not.toThrow();
    }
  });

  it('should register issues in an order that determines priority', () => {
    // Lock the registration order. The relative order of these issues
    // governs full-card display priority (getFullCardIssue returns the
    // first active full-card issue) and retry-loop priority. Alphabetizing
    // the list in factory.ts would silently change both. Triggering in a
    // scrambled order proves getIssueDescriptions reflects registration
    // order, not trigger order.
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
    const manager = createIssueManager(api, createSubscriptionHealth());

    manager.trigger('media_query', { error: new Error('x') });
    manager.trigger('initialization', { error: new Error('x') });
    manager.trigger('config_error', { error: new Error('x') });
    manager.trigger('view_incompatible', { error: new Error('x') });

    const keys = manager
      .getStateManager()
      .getIssueDescriptions()
      .map((d) => d.key);

    expect(keys).toEqual([
      'config_error',
      'view_incompatible',
      'initialization',
      'media_query',
    ]);
  });

  it('should wire changeCallback so an issue can ask for a re-evaluation', () => {
    const api = createCardAPI();
    vi.mocked(api.getConditionStateManager).mockReturnValue(new ConditionStateManager());
    const health = createSubscriptionHealth();

    const manager = createIssueManager(api, health);
    vi.mocked(api.getCardElementManager().update).mockClear();

    // A subscription starts failing. Nothing has asked the IssueManager to
    // re-evaluate, so it does not know yet.
    health.getFailures.mockReturnValue([{ key: 'camera-1', error: 'failed' }]);
    expect(api.getCardElementManager().update).not.toHaveBeenCalled();

    // The callback EventSubscriptionIssue registered is what asks it to
    // re-evaluate.
    const changeCallback = health.addListener.mock.calls[0][0];
    changeCallback();

    expect(manager.getStateManager().getIssuePresence().has('event_subscription')).toBe(
      true,
    );
    expect(api.getCardElementManager().update).toHaveBeenCalled();
  });

  it('should report a media failure raised by a component', () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ view: 'live', camera: 'camera-1' }),
    );

    const manager = createIssueManager(api, createSubscriptionHealth());

    stateManager.setState({ targetID: 'camera-1', view: 'live' });
    expect(manager.getStateManager().getIssuePresence().has('media_unavailable')).toBe(
      false,
    );

    manager.trigger('media_unavailable', {
      targetID: 'camera-1',
      reason: 'not_loading',
    });

    expect(manager.getStateManager().getIssuePresence().has('media_unavailable')).toBe(
      true,
    );
  });
});
