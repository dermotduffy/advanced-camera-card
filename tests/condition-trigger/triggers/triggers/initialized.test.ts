import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { InitializedTrigger } from '../../../../src/condition-trigger/triggers/triggers/initialized';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

describe('InitializedTrigger', () => {
  const create = (
    trigger: TriggerOfType<'initialized'>,
  ): {
    initializedTrigger: InitializedTrigger;
    stateManager: ConditionStateManager;
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const initializedTrigger = new InitializedTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    );
    return { initializedTrigger, stateManager, callback };
  };

  it('should trigger every time the card initializes', () => {
    const { initializedTrigger, stateManager, callback } = create({
      trigger: 'initialized',
      ever: false,
    });
    initializedTrigger.subscribe(callback);

    stateManager.setState({ initialized: true });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ platform: 'acc', type: 'initialized' });

    // The card goes down, as it does when taken off the page, and comes back.
    stateManager.setState({ initialized: false });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ initialized: true });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on the first time the card initializes when ever', () => {
    const { initializedTrigger, stateManager, callback } = create({
      trigger: 'initialized',
      ever: true,
    });
    initializedTrigger.subscribe(callback);

    stateManager.setState({ initialized: true, everInitialized: true });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ initialized: false });
    stateManager.setState({ initialized: true, everInitialized: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should stop triggering after destroy', () => {
    const { initializedTrigger, stateManager, callback } = create({
      trigger: 'initialized',
      ever: false,
    });
    initializedTrigger.subscribe(callback);
    initializedTrigger.destroy();

    stateManager.setState({ initialized: true });
    expect(callback).not.toHaveBeenCalled();
  });
});
