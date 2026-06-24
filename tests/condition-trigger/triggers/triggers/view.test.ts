import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { ViewTrigger } from '../../../../src/condition-trigger/triggers/triggers/view';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('ViewTrigger', () => {
  const create = (
    trigger: TriggerOfType<'view'>,
  ): {
    viewTrigger: ViewTrigger;
    stateManager: ConditionStateManager;
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const viewTrigger = new ViewTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    );
    return { viewTrigger, stateManager, callback };
  };

  it('should trigger when the selected view changes to a listed one', () => {
    const { viewTrigger, stateManager, callback } = create({
      trigger: 'view',
      views: ['live'],
    });
    viewTrigger.subscribe(callback);

    stateManager.setState({ view: 'clip' });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ view: 'live' });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'view',
      from_acc: { view: 'clip' },
      to_acc: { view: 'live' },
    });
  });

  it('should trigger again when the view changes between two listed views', () => {
    const { viewTrigger, stateManager, callback } = create({
      trigger: 'view',
      views: ['live', 'clips'],
    });
    viewTrigger.subscribe(callback);

    stateManager.setState({ view: 'live' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ view: 'clips' });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should not trigger once the view leaves the listed set', () => {
    const { viewTrigger, stateManager, callback } = create({
      trigger: 'view',
      views: ['live'],
    });
    viewTrigger.subscribe(callback);

    stateManager.setState({ view: 'live' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ view: 'clips' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on any view change without a listed set', () => {
    const { viewTrigger, stateManager, callback } = create({ trigger: 'view' });
    viewTrigger.subscribe(callback);

    stateManager.setState({ view: 'clips' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ view: 'live' });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should stop triggering after destroy', () => {
    const { viewTrigger, stateManager, callback } = create({
      trigger: 'view',
      views: ['live'],
    });
    viewTrigger.subscribe(callback);
    viewTrigger.destroy();

    stateManager.setState({ view: 'live' });
    expect(callback).not.toHaveBeenCalled();
  });
});
