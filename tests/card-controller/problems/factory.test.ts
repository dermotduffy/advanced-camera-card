// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProblemManager } from '../../../src/card-controller/problems/factory';
import { ProblemManager } from '../../../src/card-controller/problems/problem-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { createCardAPI } from '../../test-utils';

describe('createProblemManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a ProblemManager instance', () => {
    const manager = createProblemManager(createCardAPI());
    expect(manager).toBeInstanceOf(ProblemManager);
  });

  it('should register all expected problems', () => {
    const manager = createProblemManager(createCardAPI()).getStateManager();

    expect(manager.getProblemDescriptions()).toHaveLength(0);

    const expectedKeys = [
      'config_error',
      'config_upgrade',
      'connection',
      'initialization',
      'legacy_resource',
      'media_query',
      'media_load',
    ] as const;

    for (const key of expectedKeys) {
      expect(() => manager.getNotification(key)).not.toThrow();
    }
  });

  it('should wire changeCallback so timer-based problems activate via evaluate', () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = createProblemManager(api);

    // Setting view starts the media_load timer (via the condition state
    // listener → evaluate → detectDynamic).
    stateManager.setState({ view: 'live' });
    expect(manager.getStateManager().getProblemPresence().has('media_load')).toBe(false);

    // After the timeout, the changeCallback fires evaluate which
    // updates the card element.
    vi.advanceTimersByTime(10000);

    expect(manager.getStateManager().getProblemPresence().has('media_load')).toBe(true);
  });
});
