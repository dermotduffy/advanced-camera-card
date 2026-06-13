import { describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { ACCTrigger } from '../../../../src/condition-trigger/triggers/triggers/acc';
import { Trigger } from '../../../../src/config/schema/condition-trigger/triggers/types';

// @vitest-environment jsdom
describe('ACCTrigger', () => {
  const create = (
    trigger: Trigger,
  ): {
    acc: ACCTrigger;
    stateManager: ConditionStateManager;
    onFire: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const onFire = vi.fn();
    const acc = new ACCTrigger(trigger, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    });
    return { acc, stateManager, onFire };
  };

  it('should fire when the selected camera changes to a listed one', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'camera',
      cameras: ['front', 'back'],
    });
    acc.subscribe(onFire);

    // An unlisted camera does not fire.
    stateManager.setState({ camera: 'side' });
    expect(onFire).not.toHaveBeenCalled();

    // Crossing to a listed camera fires, with the before/after trigger data.
    stateManager.setState({ camera: 'front' });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith({
      platform: 'acc',
      type: 'camera',
      from_acc: { camera: 'side' },
      to_acc: { camera: 'front' },
    });
  });

  it('should fire again when the camera changes between two listed cameras', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'camera',
      cameras: ['front', 'back'],
    });
    acc.subscribe(onFire);

    stateManager.setState({ camera: 'front' });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Still matching, but the camera moved: fires again.
    stateManager.setState({ camera: 'back' });
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'camera',
      from_acc: { camera: 'front' },
      to_acc: { camera: 'back' },
    });
  });

  it('should not fire on an unrelated state change while still matching', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    acc.subscribe(onFire);

    stateManager.setState({ camera: 'front' });
    expect(onFire).toHaveBeenCalledTimes(1);

    // The camera is unchanged (still matching); an unrelated state change must
    // not re-fire the trigger.
    stateManager.setState({ fullscreen: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should not fire once the camera leaves the listed set', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    acc.subscribe(onFire);

    stateManager.setState({ camera: 'front' });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Leaving the set notifies with result false, but must not fire.
    stateManager.setState({ camera: 'side' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should fire for a view trigger', () => {
    const { acc, stateManager, onFire } = create({ trigger: 'view', views: ['live'] });
    acc.subscribe(onFire);

    stateManager.setState({ view: 'clip' });
    expect(onFire).not.toHaveBeenCalled();

    stateManager.setState({ view: 'live' });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'view',
      from_acc: { view: 'clip' },
      to_acc: { view: 'live' },
    });
  });

  it('should fire without before/after trigger data when the change has no camera or view', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'fullscreen',
      fullscreen: true,
    });
    acc.subscribe(onFire);

    stateManager.setState({ fullscreen: true });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith({ platform: 'acc', type: 'fullscreen' });
  });

  it('should include camera and view in the trigger data', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    acc.subscribe(onFire);

    stateManager.setState({ camera: 'side', view: 'live' });
    stateManager.setState({ camera: 'front' });
    expect(onFire).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'camera',
      from_acc: { camera: 'side', view: 'live' },
      to_acc: { camera: 'front', view: 'live' },
    });
  });

  it('should fire without before/after trigger data for a source with no state change', () => {
    const addEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia')
      .mockReturnValueOnce({
        addEventListener,
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList)
      .mockReturnValueOnce({ matches: false } as unknown as MediaQueryList)
      .mockReturnValueOnce({ matches: true } as unknown as MediaQueryList);

    const { acc, onFire } = create({ trigger: 'screen', media_query: 'whatever' });
    acc.subscribe(onFire);

    // The matchMedia change re-evaluates without a ConditionStateChange.
    addEventListener.mock.calls[0][1]();
    expect(onFire).toHaveBeenCalledWith({ platform: 'acc', type: 'screen' });

    vi.restoreAllMocks();
  });

  it('should stop firing after destroy', () => {
    const { acc, stateManager, onFire } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    acc.subscribe(onFire);
    acc.destroy();

    stateManager.setState({ camera: 'front' });
    expect(onFire).not.toHaveBeenCalled();
  });
});
