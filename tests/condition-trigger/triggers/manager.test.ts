import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';

import { TemplateManager } from '../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { TriggersManager } from '../../../src/condition-trigger/triggers/manager';
import type { Trigger } from '../../../src/config/schema/condition-trigger/triggers/types';
import {
  createHASS,
  createHASSManager,
  createMockTemplateRenderer,
  createStateEntity,
} from '../../test-utils';

const templateManager = createMockTemplateRenderer();

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
    const manager = new TriggersManager(
      triggers,
      stateManager,
      createHASSManager(),
      templateManager,
    );
    manager.subscribe();
    const listener = vi.fn();
    return { manager, stateManager, listener };
  };

  it('should notify a listener when any of its trigger evaluators triggers', () => {
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

  it('should stop triggering after destroy', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
    ]);
    manager.addListener(listener);
    manager.destroy();

    stateManager.setState({ camera: 'front' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should subscribe its evaluators only once', () => {
    const { manager, stateManager, listener } = create([
      { trigger: 'camera', cameras: ['front'] },
    ]);
    manager.addListener(listener);

    // A repeat subscribe is ignored, so the evaluator is not attached twice and
    // the listener fires once rather than once per subscription.
    manager.subscribe();

    stateManager.setState({ camera: 'front' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('enabled', () => {
    const ENABLED_TEMPLATE = '{{ is_state("binary_sensor.flag", "on") }}';

    // These cases gate on a rendered `enabled` template, so use a real engine
    // loaded for the synchronous renderer (rather than the shared mock).
    const templateManager = new TemplateManager();
    beforeAll(async () => {
      await templateManager.loadRenderer();
    });

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
        createHASSManager(),
        templateManager,
      );
      manager.subscribe();
      const listener = vi.fn();
      manager.addListener(listener);
      return { stateManager, listener };
    };

    it('should not trigger a disabled trigger', () => {
      const { manager, stateManager, listener } = create([
        { trigger: 'camera', cameras: ['front'], enabled: false },
      ]);
      manager.addListener(listener);

      stateManager.setState({ camera: 'front' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should trigger an explicitly enabled trigger', () => {
      const { manager, stateManager, listener } = create([
        { trigger: 'camera', cameras: ['front'], enabled: true },
      ]);
      manager.addListener(listener);

      stateManager.setState({ camera: 'front' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not trigger a trigger whose enabled template does not render true', () => {
      const { stateManager, listener } = createWithFlag(ENABLED_TEMPLATE, 'off');

      stateManager.setState({ camera: 'front' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should trigger a trigger whose enabled template renders true', () => {
      const { stateManager, listener } = createWithFlag(ENABLED_TEMPLATE, 'on');

      stateManager.setState({ camera: 'front' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not trigger a trigger whose enabled template cannot render without hass', () => {
      const { stateManager, listener } = createWithFlag(ENABLED_TEMPLATE, null);

      stateManager.setState({ camera: 'front' });

      // With no hass the enabled template cannot render, so the trigger fails
      // closed and does not fire.
      expect(listener).not.toHaveBeenCalled();
    });

    it('should re-evaluate the enabled template on each trigger', () => {
      const stateManager = new ConditionStateManager();
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'off' }) }),
      });
      const manager = new TriggersManager(
        [{ trigger: 'camera', cameras: ['front', 'back'], enabled: ENABLED_TEMPLATE }],
        stateManager,
        createHASSManager(),
        templateManager,
      );
      manager.subscribe();
      const listener = vi.fn();
      manager.addListener(listener);

      // Flag off: the enabled template renders false, so the camera change is
      // suppressed and the listener is not notified.
      stateManager.setState({ camera: 'front' });
      expect(listener).not.toHaveBeenCalled();

      // Flag flips on: a subsequent trigger is now allowed through.
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'on' }) }),
      });
      stateManager.setState({ camera: 'back' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
