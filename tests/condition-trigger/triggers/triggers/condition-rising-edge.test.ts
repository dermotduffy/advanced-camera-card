import { describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { ConditionRisingEdgeTrigger } from '../../../../src/condition-trigger/triggers/triggers/condition-rising-edge';
import { Trigger } from '../../../../src/config/schema/condition-trigger/triggers/types';
import { createConfig } from '../../../test-utils';

// @vitest-environment jsdom
describe('ConditionRisingEdgeTrigger', () => {
  const create = (
    trigger: Trigger,
  ): {
    risingEdge: ConditionRisingEdgeTrigger;
    stateManager: ConditionStateManager;
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const risingEdge = new ConditionRisingEdgeTrigger(trigger, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    });
    return { risingEdge, stateManager, callback };
  };

  it('should trigger when the card-specific source reaches the configured value', () => {
    const { risingEdge, stateManager, callback } = create({
      trigger: 'display_mode',
      display_mode: 'single',
    });
    risingEdge.subscribe(callback);

    // A non-matching value does not trigger.
    stateManager.setState({ displayMode: 'grid' });
    expect(callback).not.toHaveBeenCalled();

    // Reaching the configured value triggers.
    stateManager.setState({ displayMode: 'single' });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ platform: 'acc', type: 'display_mode' });
  });

  it('should not trigger on an unrelated state change while still matching', () => {
    const { risingEdge, stateManager, callback } = create({
      trigger: 'display_mode',
      display_mode: 'single',
    });
    risingEdge.subscribe(callback);

    stateManager.setState({ displayMode: 'single' });
    expect(callback).toHaveBeenCalledTimes(1);

    // The display mode is unchanged (still matching); an unrelated state change
    // must not re-trigger the callback.
    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger without before/after trigger data when the change has no camera, view or config', () => {
    const { risingEdge, stateManager, callback } = create({
      trigger: 'fullscreen',
      fullscreen: true,
    });
    risingEdge.subscribe(callback);

    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ platform: 'acc', type: 'fullscreen' });
  });

  it('should include camera, view and config in the trigger data', () => {
    const config = createConfig();
    const { risingEdge, stateManager, callback } = create({
      trigger: 'display_mode',
      display_mode: 'single',
    });
    risingEdge.subscribe(callback);

    stateManager.setState({
      displayMode: 'grid',
      camera: 'front',
      view: 'live',
      config,
    });
    stateManager.setState({ displayMode: 'single' });
    expect(callback).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'display_mode',
      from_acc: { camera: 'front', view: 'live', config },
      to_acc: { camera: 'front', view: 'live', config },
    });
  });

  it('should trigger without before/after trigger data for a source with no state change', () => {
    const addEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia')
      .mockReturnValueOnce({
        addEventListener,
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList)
      .mockReturnValueOnce({ matches: false } as unknown as MediaQueryList)
      .mockReturnValueOnce({ matches: true } as unknown as MediaQueryList);

    const { risingEdge, callback } = create({
      trigger: 'screen',
      media_query: 'whatever',
    });
    risingEdge.subscribe(callback);

    // The matchMedia change re-evaluates without a ConditionStateChange.
    addEventListener.mock.calls[0][1]();
    expect(callback).toHaveBeenCalledWith({ platform: 'acc', type: 'screen' });

    vi.restoreAllMocks();
  });

  it('should stop triggering after destroy', () => {
    const { risingEdge, stateManager, callback } = create({
      trigger: 'display_mode',
      display_mode: 'single',
    });
    risingEdge.subscribe(callback);
    risingEdge.destroy();

    stateManager.setState({ displayMode: 'single' });
    expect(callback).not.toHaveBeenCalled();
  });
});
