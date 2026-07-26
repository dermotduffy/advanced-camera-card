import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { TriggeredTrigger } from '../../../../src/condition-trigger/triggers/triggers/triggered';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

describe('TriggeredTrigger', () => {
  const create = (
    trigger: TriggerOfType<'triggered'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new TriggeredTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    ).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger on any change to the triggered set without a value', () => {
    const { stateManager, callback } = create({ trigger: 'triggered' });
    stateManager.setState({ triggered: new Set(['front']) });
    stateManager.setState({ triggered: new Set(['front', 'back']) });
    stateManager.setState({ triggered: new Set() });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should trigger only when a listed camera is among the triggered set', () => {
    const { stateManager, callback } = create({
      trigger: 'triggered',
      triggered: ['front'],
    });

    stateManager.setState({ triggered: new Set(['back']) });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ triggered: new Set(['front']) });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
