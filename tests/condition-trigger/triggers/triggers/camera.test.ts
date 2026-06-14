import { describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { CameraTrigger } from '../../../../src/condition-trigger/triggers/triggers/camera';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createConfig } from '../../../test-utils';

// @vitest-environment jsdom
describe('CameraTrigger', () => {
  const create = (
    trigger: TriggerOfType<'camera'>,
  ): {
    cameraTrigger: CameraTrigger;
    stateManager: ConditionStateManager;
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const cameraTrigger = new CameraTrigger(trigger, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    });
    return { cameraTrigger, stateManager, callback };
  };

  it('should trigger when the selected camera changes to a listed one', () => {
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: ['front', 'back'],
    });
    cameraTrigger.subscribe(callback);

    // An unlisted camera does not trigger.
    stateManager.setState({ camera: 'side' });
    expect(callback).not.toHaveBeenCalled();

    // Crossing to a listed camera triggers, with the before/after trigger data.
    stateManager.setState({ camera: 'front' });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      platform: 'acc',
      type: 'camera',
      from_acc: { camera: 'side' },
      to_acc: { camera: 'front' },
    });
  });

  it('should trigger again when the camera changes between two listed cameras', () => {
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: ['front', 'back'],
    });
    cameraTrigger.subscribe(callback);

    stateManager.setState({ camera: 'front' });
    expect(callback).toHaveBeenCalledTimes(1);

    // Still matching, but the camera moved: triggers again.
    stateManager.setState({ camera: 'back' });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'camera',
      from_acc: { camera: 'front' },
      to_acc: { camera: 'back' },
    });
  });

  it('should not trigger on an unrelated state change while the camera is unchanged', () => {
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    cameraTrigger.subscribe(callback);

    stateManager.setState({ camera: 'front' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger once the camera leaves the listed set', () => {
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    cameraTrigger.subscribe(callback);

    stateManager.setState({ camera: 'front' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ camera: 'side' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on any camera change without a listed set', () => {
    const { cameraTrigger, stateManager, callback } = create({ trigger: 'camera' });
    cameraTrigger.subscribe(callback);

    stateManager.setState({ camera: 'side' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ camera: 'front' });
    expect(callback).toHaveBeenCalledTimes(2);

    // An unrelated change leaves the camera unchanged: no trigger.
    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only when the camera becomes unselected for an empty list', () => {
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: [],
    });
    cameraTrigger.subscribe(callback);

    // Changing between cameras does not trigger.
    stateManager.setState({ camera: 'front' });
    stateManager.setState({ camera: 'back' });
    expect(callback).not.toHaveBeenCalled();

    // Becoming unselected triggers.
    stateManager.setState({ camera: undefined });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should include camera, view and config in the trigger data', () => {
    const config = createConfig();
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    cameraTrigger.subscribe(callback);

    stateManager.setState({ camera: 'side', view: 'live', config });
    stateManager.setState({ camera: 'front' });
    expect(callback).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'camera',
      from_acc: { camera: 'side', view: 'live', config },
      to_acc: { camera: 'front', view: 'live', config },
    });
  });

  it('should stop triggering after destroy', () => {
    const { cameraTrigger, stateManager, callback } = create({
      trigger: 'camera',
      cameras: ['front'],
    });
    cameraTrigger.subscribe(callback);
    cameraTrigger.destroy();

    stateManager.setState({ camera: 'front' });
    expect(callback).not.toHaveBeenCalled();
  });
});
