import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConditionsManager } from '../../../src/condition-trigger/conditions/conditions-manager';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createHASS, createStateEntity } from '../../test-utils';

// Per-condition-type evaluation is covered by tests/conditions/conditions/<type>.test.ts.
// This file covers the manager's own orchestration: building/destroying evaluators,
// listener management, trigger-data merging, and notifying (or not) on changes.

// @vitest-environment jsdom
describe('ConditionsManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not call listeners for HA state changes without a relevant condition', () => {
    const stateManager = new ConditionStateManager();
    const manager = new ConditionsManager(
      [
        {
          condition: 'fullscreen' as const,
          fullscreen: true,
        },
      ],
      stateManager,
    );

    const listener = vi.fn();
    manager.addListener(listener);

    stateManager.setState({
      hass: createHASS({ 'sensor.foo': createStateEntity({ state: '11' }) }),
    });

    expect(listener).not.toBeCalled();
  });

  it('should notify on each change and merge trigger data across multiple conditions', () => {
    const stateManager = new ConditionStateManager();
    const manager = new ConditionsManager(
      [
        { condition: 'state' as const, entity_id: 'switch.one' },
        { condition: 'state' as const, entity_id: 'switch.two' },
      ],
      stateManager,
    );

    const listener = vi.fn();
    manager.addListener(listener);

    stateManager.setState({
      hass: createHASS({
        'switch.one': createStateEntity({ state: 'on' }),
        'switch.two': createStateEntity({ state: 'off' }),
      }),
    });
    expect(listener).toHaveBeenLastCalledWith({
      result: true,
      triggerData: {
        // Only the last matching condition's data is retained.
        state: {
          entity: 'switch.two',
          to: 'off',
        },
      },
    });

    // The result stays true but the trigger data changes, so listeners are
    // still notified.
    stateManager.setState({
      hass: createHASS({
        'switch.one': createStateEntity({ state: 'off' }),
        'switch.two': createStateEntity({ state: 'on' }),
      }),
    });
    expect(listener).toHaveBeenLastCalledWith({
      result: true,
      triggerData: {
        state: {
          entity: 'switch.two',
          from: 'off',
          to: 'on',
        },
      },
    });

    expect(listener).toBeCalledTimes(2);
  });

  it('should re-evaluate and notify when a subscribed condition source changes', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia')
      .mockReturnValueOnce({
        addEventListener: addEventListener,
        removeEventListener: removeEventListener,
      } as unknown as MediaQueryList)
      .mockReturnValueOnce({
        matches: false,
      } as unknown as MediaQueryList)
      .mockReturnValueOnce({
        matches: true,
      } as unknown as MediaQueryList);

    const manager = new ConditionsManager([
      { condition: 'screen' as const, media_query: 'whatever' },
    ]);

    const listener = vi.fn();
    manager.addListener(listener);

    // Fire the media-query change; the manager re-evaluates and notifies.
    addEventListener.mock.calls[0][1]();
    expect(listener).toBeCalledWith({ result: true, triggerData: {} });

    // Destroy tears the subscription down via the evaluator.
    manager.destroy();
    expect(removeEventListener).toBeCalled();
  });

  describe('should handle listeners correctly', () => {
    it('should add listener', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toBeCalledWith({ result: true, triggerData: {} });
      expect(listener).toBeCalledTimes(1);

      stateManager.setState({ fullscreen: false });
      expect(listener).toBeCalledWith({ result: false });
      expect(listener).toBeCalledTimes(2);

      // Re-add the same listener (will still only be called once).
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toBeCalledWith({ result: true, triggerData: {} });
      expect(listener).toBeCalledTimes(3);
    });

    it('should remove listener', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);
      manager.removeListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).not.toBeCalled();
    });

    it('should remove listener on destroy', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);
      manager.destroy();

      stateManager.setState({ fullscreen: true });

      expect(listener).not.toBeCalled();
    });

    it('should not call listeners when the condition result does not change', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'view' as const, views: ['live'] }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);

      stateManager.setState({ view: 'live' });
      expect(listener).toBeCalledTimes(1);

      stateManager.setState({ view: 'clip' });
      expect(listener).toBeCalledTimes(2);

      stateManager.setState({ view: 'clip' });
      expect(listener).toBeCalledTimes(2);

      stateManager.setState({ view: 'live' });
      expect(listener).toBeCalledTimes(3);

      stateManager.setState({ view: 'live' });
      expect(listener).toBeCalledTimes(3);
    });
  });
});
