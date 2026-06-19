import { describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { MediaLoadedTrigger } from '../../../../src/condition-trigger/triggers/triggers/media-loaded';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createMediaLoadedInfo } from '../../../test-utils';

// @vitest-environment jsdom
describe('MediaLoadedTrigger', () => {
  const create = (
    trigger: TriggerOfType<'media_loaded'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new MediaLoadedTrigger(trigger, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    }).subscribe(callback);
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
