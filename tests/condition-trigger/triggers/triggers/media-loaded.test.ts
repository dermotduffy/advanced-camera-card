import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { MediaLoadedTrigger } from '../../../../src/condition-trigger/triggers/triggers/media-loaded';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createMediaLoadedInfo } from '../../../test-utils';
import { createTriggerEvaluatorContext } from './test-utils';

describe('MediaLoadedTrigger', () => {
  const create = (
    trigger: TriggerOfType<'media_loaded'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new MediaLoadedTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    ).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger when media presence changes without a value', () => {
    const { stateManager, callback } = create({ trigger: 'media_loaded' });

    stateManager.setState({ mediaLoadedInfo: createMediaLoadedInfo() });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ mediaLoadedInfo: null });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on changes to the given value', () => {
    const { stateManager, callback } = create({
      trigger: 'media_loaded',
      media_loaded: true,
    });

    stateManager.setState({ mediaLoadedInfo: createMediaLoadedInfo() });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ mediaLoadedInfo: null });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { stateManager, callback } = create({
      trigger: 'media_loaded',
      media_loaded: false,
    });

    stateManager.setState({ mediaLoadedInfo: createMediaLoadedInfo() });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ mediaLoadedInfo: null });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
