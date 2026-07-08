import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { CallTrigger } from '../../../../src/condition-trigger/triggers/triggers/call';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
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
    stateManager.setState({ call: { active: false, answered: false } });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: { active: true, answered: false } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger only on changes to the given value', () => {
    const { stateManager, callback } = create({ trigger: 'call', call: true });
    stateManager.setState({ call: { active: true, answered: false } });
    stateManager.setState({ call: { active: false, answered: false } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { stateManager, callback } = create({ trigger: 'call', call: false });

    stateManager.setState({ call: { active: true, answered: false } });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: { active: false, answered: false } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not fire on an answer when the trigger does not care about answered', () => {
    const { stateManager, callback } = create({ trigger: 'call', call: true });

    stateManager.setState({ call: { active: true, answered: false } });
    expect(callback).toHaveBeenCalledTimes(1);

    // The call is answered mid-call -- `active` doesn't change, so a plain
    // `call: true` trigger (no `answered`) must not fire again.
    stateManager.setState({ call: { active: true, answered: true } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should fire on the answer transition when answered is specified', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      call: true,
      answered: true,
    });

    stateManager.setState({ call: { active: true, answered: false } });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: { active: true, answered: true } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should distinguish rejected (ended unanswered) from ended-after-answered', () => {
    const rejected = create({ trigger: 'call', call: false, answered: false });
    const hungUp = create({ trigger: 'call', call: false, answered: true });

    rejected.stateManager.setState({ call: { active: true, answered: false } });
    hungUp.stateManager.setState({ call: { active: true, answered: false } });

    rejected.stateManager.setState({ call: { active: false, answered: false } });
    hungUp.stateManager.setState({ call: { active: false, answered: false } });

    expect(rejected.callback).toHaveBeenCalledTimes(1);
    expect(hungUp.callback).not.toHaveBeenCalled();
  });
});
