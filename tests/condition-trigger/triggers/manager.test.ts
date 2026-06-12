import { describe, expect, it, Mock, vi } from 'vitest';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { TriggersManager } from '../../../src/condition-trigger/triggers/manager';
import { Trigger } from '../../../src/config/schema/condition-trigger/triggers/types';

// @vitest-environment jsdom
describe('TriggersManager', () => {
  const create = (
    triggers: Trigger[],
  ): {
    manager: TriggersManager;
    stateManager: ConditionStateManager;
    listener: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const manager = new TriggersManager(triggers, stateManager);
    const listener = vi.fn();
    return { manager, stateManager, listener };
  };

  it('should notify a listener when any of its triggers fires', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
      { trigger: 'view', views: ['live'] },
    ]);
    manager.addListener(listener);

    stateManager.setState({ camera: 'front' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ platform: 'acc', type: 'camera' }),
    );

    stateManager.setState({ view: 'live' });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ platform: 'acc', type: 'view' }),
    );
  });

  it('should notify every registered listener', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
    ]);
    const other = vi.fn();
    manager.addListener(listener);
    manager.addListener(other);

    stateManager.setState({ camera: 'front' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('should register the same listener only once', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
    ]);
    manager.addListener(listener);
    manager.addListener(listener);

    stateManager.setState({ camera: 'front' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should not notify a removed listener', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
    ]);
    manager.addListener(listener);
    manager.removeListener(listener);

    stateManager.setState({ camera: 'front' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should stop firing after destroy', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
    ]);
    manager.addListener(listener);
    manager.destroy();

    stateManager.setState({ camera: 'front' });

    expect(listener).not.toHaveBeenCalled();
  });
});
