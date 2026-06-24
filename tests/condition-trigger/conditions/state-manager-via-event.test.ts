import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import {
  ConditionStateManagerGetEvent,
  getConditionStateManagerViaEvent,
} from '../../../src/condition-trigger/conditions/state-manager-via-event';

// @vitest-environment jsdom
describe('getConditionStateManagerViaEvent', () => {
  it('should dispatch event and retrieve state manager', () => {
    const element = document.createElement('div');
    const stateManager = mock<ConditionStateManager>();

    const handler = vi.fn().mockImplementation((ev: ConditionStateManagerGetEvent) => {
      ev.conditionStateManager = stateManager;
    });
    element.addEventListener(
      'advanced-camera-card:condition-state-manager:get',
      handler,
    );

    expect(getConditionStateManagerViaEvent(element)).toBe(stateManager);
  });

  it('should dispatch event and retrieve state manager', () => {
    const element = document.createElement('div');

    const handler = vi.fn();
    element.addEventListener(
      'advanced-camera-card:condition-state-manager:get',
      handler,
    );

    expect(getConditionStateManagerViaEvent(element)).toBeNull();
  });
});
