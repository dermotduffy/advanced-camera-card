// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createIssueManager } from '../../../src/card-controller/issues/factory';
import { IssueManager } from '../../../src/card-controller/issues/issue-manager';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createCardAPI } from '../../test-utils';
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

  it('should wire changeCallback so timer-based issues activate via evaluate', () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = createIssueManager(api, createSubscriptionHealth());

    // Setting view starts the media_unavailable timer (via the condition state
    // listener → evaluate → detectDynamic).
    stateManager.setState({ targetID: 'camera-1', view: 'live' });
    expect(manager.getStateManager().getIssuePresence().has('media_unavailable')).toBe(
      false,
    );

    // After the timeout, the changeCallback fires evaluate which
    // updates the card element.
    vi.advanceTimersByTime(10000);

    expect(manager.getStateManager().getIssuePresence().has('media_unavailable')).toBe(
      true,
    );
  });
});
