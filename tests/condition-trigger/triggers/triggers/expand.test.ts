import { describe, expect, it, Mock, vi } from 'vitest';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { ExpandTrigger } from '../../../../src/condition-trigger/triggers/triggers/expand';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('ExpandTrigger', () => {
  const create = (
    trigger: TriggerOfType<'expand'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new ExpandTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    ).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger on any change without a value', () => {
    const { stateManager, callback } = create({ trigger: 'expand' });
    stateManager.setState({ expand: true });
    stateManager.setState({ expand: false });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on changes to the given value', () => {
    const { stateManager, callback } = create({ trigger: 'expand', expand: true });
    stateManager.setState({ expand: true });
    stateManager.setState({ expand: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { stateManager, callback } = create({ trigger: 'expand', expand: false });

    stateManager.setState({ expand: true });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ expand: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
