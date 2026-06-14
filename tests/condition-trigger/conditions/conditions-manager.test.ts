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

  it('should forward the triggering state change to listeners', () => {
    const stateManager = new ConditionStateManager();
    const manager = new ConditionsManager(
      [{ condition: 'fullscreen' as const, fullscreen: true }],
      stateManager,
    );

    const listener = vi.fn();
    manager.addListener(listener);

    stateManager.setState({ fullscreen: true });

    // The change that prompted the evaluation is passed through verbatim.
    expect(listener).toHaveBeenLastCalledWith(expect.anything(), {
      old: {},
      change: { fullscreen: true },
      new: { fullscreen: true },
    });
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
    expect(listener).toBeCalledWith({ result: true }, undefined);

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

      expect(listener).toBeCalledWith({ result: true }, expect.anything());
      expect(listener).toBeCalledTimes(1);

      stateManager.setState({ fullscreen: false });
      expect(listener).toBeCalledWith({ result: false }, expect.anything());
      expect(listener).toBeCalledTimes(2);

      // Re-add the same listener (will still only be called once).
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toBeCalledWith({ result: true }, expect.anything());
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

  describe('enabled', () => {
    const ENABLED_TEMPLATE = '{{ is_state("binary_sensor.flag", "on") }}';

    it('should ignore a disabled condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true, enabled: false }],
        stateManager,
      );

      // The disabled condition is ignored, so with no remaining conditions the
      // result is true even though fullscreen does not match.
      stateManager.setState({ fullscreen: false });

      expect(manager.getEvaluation()).toEqual({ result: true });
    });

    it('should evaluate an enabled condition normally', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true, enabled: true }],
        stateManager,
      );

      stateManager.setState({ fullscreen: false });
      expect(manager.getEvaluation()).toEqual({ result: false });

      stateManager.setState({ fullscreen: true });
      expect(manager.getEvaluation()).toEqual({ result: true });
    });

    it('should drop a condition whose enabled template does not render true', () => {
      const stateManager = new ConditionStateManager();
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'off' }) }),
      });
      const manager = new ConditionsManager(
        [
          {
            condition: 'fullscreen' as const,
            fullscreen: true,
            enabled: ENABLED_TEMPLATE,
          },
        ],
        stateManager,
      );

      stateManager.setState({ fullscreen: false });

      expect(manager.getEvaluation()).toEqual({ result: true });
    });

    it('should evaluate a condition whose enabled template renders true', () => {
      const stateManager = new ConditionStateManager();
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'on' }) }),
      });
      const manager = new ConditionsManager(
        [
          {
            condition: 'fullscreen' as const,
            fullscreen: true,
            enabled: ENABLED_TEMPLATE,
          },
        ],
        stateManager,
      );

      stateManager.setState({ fullscreen: false });

      expect(manager.getEvaluation()).toEqual({ result: false });
    });

    it('should evaluate a condition with an enabled template when hass is absent', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [
          {
            condition: 'fullscreen' as const,
            fullscreen: true,
            enabled: ENABLED_TEMPLATE,
          },
        ],
        stateManager,
      );

      stateManager.setState({ fullscreen: false });

      expect(manager.getEvaluation()).toEqual({ result: false });
    });

    it('should re-evaluate the enabled template on each evaluation', () => {
      const stateManager = new ConditionStateManager();
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'off' }) }),
        fullscreen: false,
      });
      const manager = new ConditionsManager(
        [
          {
            condition: 'fullscreen' as const,
            fullscreen: true,
            enabled: ENABLED_TEMPLATE,
          },
        ],
        stateManager,
      );

      // Flag off: the condition is disabled and ignored, so the result is true.
      expect(manager.getEvaluation()).toEqual({ result: true });

      // Flag on: the condition is now active and fullscreen does not match.
      stateManager.setState({
        hass: createHASS({ 'binary_sensor.flag': createStateEntity({ state: 'on' }) }),
      });
      expect(manager.getEvaluation()).toEqual({ result: false });
    });
  });
});
