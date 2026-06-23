import { describe, expect, it, Mock, vi } from 'vitest';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { DisplayModeTrigger } from '../../../../src/condition-trigger/triggers/triggers/display-mode';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('DisplayModeTrigger', () => {
  const create = (
    trigger: TriggerOfType<'display_mode'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new DisplayModeTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    ).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger on any change without a value', () => {
    const { stateManager, callback } = create({ trigger: 'display_mode' });
    stateManager.setState({ displayMode: 'single' });
    stateManager.setState({ displayMode: 'grid' });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on changes to the given value', () => {
    const { stateManager, callback } = create({
      trigger: 'display_mode',
      display_mode: 'grid',
    });
    stateManager.setState({ displayMode: 'single' });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ displayMode: 'grid' });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
