import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { InteractionTrigger } from '../../../../src/condition-trigger/triggers/triggers/interaction';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

describe('InteractionTrigger', () => {
  const create = (
    trigger: TriggerOfType<'interaction'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new InteractionTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    ).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger on any change without a value', () => {
    const { stateManager, callback } = create({ trigger: 'interaction' });
    stateManager.setState({ interaction: true });
    stateManager.setState({ interaction: false });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on changes to the given value', () => {
    const { stateManager, callback } = create({
      trigger: 'interaction',
      interaction: true,
    });
    stateManager.setState({ interaction: true });
    stateManager.setState({ interaction: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { stateManager, callback } = create({
      trigger: 'interaction',
      interaction: false,
    });

    stateManager.setState({ interaction: true });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ interaction: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
