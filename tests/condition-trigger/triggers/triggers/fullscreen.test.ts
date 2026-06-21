import { describe, expect, it, Mock, vi } from 'vitest';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { FullscreenTrigger } from '../../../../src/condition-trigger/triggers/triggers/fullscreen';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('FullscreenTrigger', () => {
  const create = (
    trigger: TriggerOfType<'fullscreen'>,
  ): {
    fullscreenTrigger: FullscreenTrigger;
    stateManager: ConditionStateManager;
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const fullscreenTrigger = new FullscreenTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    );
    return { fullscreenTrigger, stateManager, callback };
  };

  it('should trigger on any change without a value', () => {
    const { fullscreenTrigger, stateManager, callback } = create({
      trigger: 'fullscreen',
    });
    fullscreenTrigger.subscribe(callback);

    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ platform: 'acc', type: 'fullscreen' });

    // The falling edge triggers too.
    stateManager.setState({ fullscreen: false });
    expect(callback).toHaveBeenCalledTimes(2);

    // An unrelated change does not.
    stateManager.setState({ expand: true });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on changes to the given value', () => {
    const { fullscreenTrigger, stateManager, callback } = create({
      trigger: 'fullscreen',
      fullscreen: true,
    });
    fullscreenTrigger.subscribe(callback);

    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(1);

    // Leaving fullscreen does not trigger this `true`-filtered trigger.
    stateManager.setState({ fullscreen: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { fullscreenTrigger, stateManager, callback } = create({
      trigger: 'fullscreen',
      fullscreen: false,
    });
    fullscreenTrigger.subscribe(callback);

    stateManager.setState({ fullscreen: true });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ fullscreen: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should stop triggering after destroy', () => {
    const { fullscreenTrigger, stateManager, callback } = create({
      trigger: 'fullscreen',
    });
    fullscreenTrigger.subscribe(callback);
    fullscreenTrigger.destroy();

    stateManager.setState({ fullscreen: true });
    expect(callback).not.toHaveBeenCalled();
  });
});
