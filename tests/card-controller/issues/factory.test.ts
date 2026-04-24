// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIssueManager } from '../../../src/card-controller/issues/factory';
import { IssueManager } from '../../../src/card-controller/issues/issue-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { createCardAPI } from '../../test-utils';

describe('createIssueManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a IssueManager instance', () => {
    const manager = createIssueManager(createCardAPI());
    expect(manager).toBeInstanceOf(IssueManager);
  });

  it('should register all expected issues', () => {
    const manager = createIssueManager(createCardAPI()).getStateManager();

    expect(manager.getIssueDescriptions()).toHaveLength(0);

    const expectedKeys = [
      'config_error',
      'config_upgrade',
      'connection',
      'initialization',
      'legacy_resource',
      'media_query',
      'media_load',
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
    const manager = createIssueManager(api);

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

    const manager = createIssueManager(api);

    // Setting view starts the media_load timer (via the condition state
    // listener → evaluate → detectDynamic).
    stateManager.setState({ targetID: 'camera-1', view: 'live' });
    expect(manager.getStateManager().getIssuePresence().has('media_load')).toBe(false);

    // After the timeout, the changeCallback fires evaluate which
    // updates the card element.
    vi.advanceTimersByTime(10000);

    expect(manager.getStateManager().getIssuePresence().has('media_load')).toBe(true);
  });
});
