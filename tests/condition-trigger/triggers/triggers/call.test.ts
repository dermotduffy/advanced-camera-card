import { describe, expect, it, Mock, vi } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { CallTrigger } from '../../../../src/condition-trigger/triggers/triggers/call';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('CallTrigger', () => {
  const create = (
    trigger: TriggerOfType<'call'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new CallTrigger(trigger, createTriggerEvaluatorContext({ stateManager })).subscribe(
      callback,
    );
    return { stateManager, callback };
  };

  it('should treat an absent call state as not-in-call', () => {
    const { stateManager, callback } = create({ trigger: 'call' });

    // Absent (undefined) is equivalent to false, so this is not a change.
    stateManager.setState({ call: false });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger only on changes to the given value', () => {
    const { stateManager, callback } = create({ trigger: 'call', call: true });
    stateManager.setState({ call: true });
    stateManager.setState({ call: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { stateManager, callback } = create({ trigger: 'call', call: false });

    stateManager.setState({ call: true });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
