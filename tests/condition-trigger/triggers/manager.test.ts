import { describe, expect, it, Mock, vi } from 'vitest';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { TriggersManager } from '../../../src/condition-trigger/triggers/manager';
import { Trigger } from '../../../src/config/schema/condition-trigger/triggers/types';
import { createHASS, createStateEntity } from '../../test-utils';

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

  describe('enabled', () => {
    const ENABLED_TEMPLATE = '{{ is_state("binary_sensor.flag", "on") }}';

    const createWithFlag = (
      enabled: string,
      state: string | null,
    ): { stateManager: ConditionStateManager; listener: Mock } => {
      const stateManager = new ConditionStateManager();
      if (state !== null) {
        stateManager.setState({
          hass: createHASS({
            'binary_sensor.flag': createStateEntity({ state }),
          }),
        });
      }
      const manager = new TriggersManager(
        [{ trigger: 'camera', cameras: ['front'], enabled }],
        stateManager,
      );
      const listener = vi.fn();
      manager.addListener(listener);
      return { stateManager, listener };
    };

    it('should not fire a disabled trigger', () => {
      const { manager, stateManager, listener } = create([
        { trigger: 'camera', cameras: ['front'], enabled: false },
      ]);
      manager.addListener(listener);

      stateManager.setState({ camera: 'front' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should fire an explicitly enabled trigger', () => {
      const { manager, stateManager, listener } = create([
        { trigger: 'camera', cameras: ['front'], enabled: true },
      ]);
      manager.addListener(listener);

      stateManager.setState({ camera: 'front' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not fire a trigger whose enabled template does not render true', () => {
      const { stateManager, listener } = createWithFlag(ENABLED_TEMPLATE, 'off');

      stateManager.setState({ camera: 'front' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should fire a trigger whose enabled template renders true', () => {
      const { stateManager, listener } = createWithFlag(ENABLED_TEMPLATE, 'on');

      stateManager.setState({ camera: 'front' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should fire a trigger with an enabled template when hass is absent', () => {
      const { stateManager, listener } = createWithFlag(ENABLED_TEMPLATE, null);

      stateManager.setState({ camera: 'front' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should re-evaluate the enabled template on each fire', () => {
      const stateManager = new ConditionStateManager();
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'off' }) }),
      });
      const manager = new TriggersManager(
        [{ trigger: 'camera', cameras: ['front', 'back'], enabled: ENABLED_TEMPLATE }],
        stateManager,
      );
      const listener = vi.fn();
      manager.addListener(listener);

      // Flag off: the trigger fires but is gated out.
      stateManager.setState({ camera: 'front' });
      expect(listener).not.toHaveBeenCalled();

      // Flag flips on: a subsequent fire is now allowed through.
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'on' }) }),
      });
      stateManager.setState({ camera: 'back' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
