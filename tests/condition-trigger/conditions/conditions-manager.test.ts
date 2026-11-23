import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateManager } from '../../../src/card-controller/templates';
import { ConditionsManager } from '../../../src/condition-trigger/conditions/conditions-manager';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import type { ConditionState } from '../../../src/condition-trigger/conditions/types';
import type { Condition } from '../../../src/config/schema/condition-trigger/conditions/types';
import {
  createHASS,
  createMockTemplateRenderer,
  createStateEntity,
  stubConnectedHomeAssistant,
  stubMatchMedia,
} from '../../test-utils';

// A mock renderer for the orchestration tests, which never render templates.
// The `enabled` template suite below uses its own real, loaded engine.
const templateManager = createMockTemplateRenderer();

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
      templateManager,
      stateManager,
    );

    const listener = vi.fn();
    manager.addListener(listener);

    stateManager.setState({
      hass: createHASS({ 'sensor.foo': createStateEntity({ state: '11' }) }),
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should forward the triggering state change to listeners', () => {
    const stateManager = new ConditionStateManager();
    const manager = new ConditionsManager(
      [{ condition: 'fullscreen' as const, fullscreen: true }],
      templateManager,
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
    stubMatchMedia()
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

    const manager = new ConditionsManager(
      [{ condition: 'screen' as const, media_query: 'whatever' }],
      templateManager,
    );

    const listener = vi.fn();
    manager.addListener(listener);

    // Fire the media-query change; the manager re-evaluates and notifies.
    addEventListener.mock.calls[0][1]();
    expect(listener).toHaveBeenCalledWith({ result: true }, undefined);

    // Destroy tears the subscription down.
    manager.destroy();
    expect(removeEventListener).toHaveBeenCalled();
  });

  describe('should handle a state condition with for', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-05T22:56:56Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const doorOpenFor5s = {
      condition: 'state' as const,
      entity: 'binary_sensor.door',
      state: 'on',
      for: '00:00:05',
    };

    const createDoorState = (state: string): ConditionState => ({
      hass: createHASS({
        'binary_sensor.door': createStateEntity({
          state,
          last_changed: '2026-06-05T22:56:56Z',
        }),
      }),
    });

    // The door has just opened, so its 5s `for` duration has not yet passed.
    const createManager = (options?: {
      conditions?: Condition[];
      stateManager?: ConditionStateManager;
    }): ConditionsManager => {
      const stateManager = options?.stateManager ?? new ConditionStateManager();
      stateManager.setState(createDoorState('on'));
      return new ConditionsManager(
        options?.conditions ?? [doorOpenFor5s],
        templateManager,
        stateManager,
      );
    };

    it('should notify once the duration passes without further state updates', () => {
      const manager = createManager();
      const listener = vi.fn();
      manager.addListener(listener);
      expect(manager.getEvaluation()).toEqual({ result: false });

      vi.advanceTimersByTime(5000);
      expect(listener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(manager.getEvaluation()).toEqual({ result: true });
      expect(listener).toHaveBeenCalledWith({ result: true }, undefined);
    });

    it('should stop re-evaluating once the for duration completes', () => {
      createManager();
      expect(vi.getTimerCount()).toBe(1);

      vi.advanceTimersByTime(5001);

      expect(vi.getTimerCount()).toBe(0);
    });

    it('should stop re-evaluating when the state stops matching', () => {
      const stateManager = new ConditionStateManager();
      const manager = createManager({ stateManager });
      const listener = vi.fn();
      manager.addListener(listener);
      expect(vi.getTimerCount()).toBe(1);

      stateManager.setState(createDoorState('off'));
      expect(vi.getTimerCount()).toBe(0);

      vi.advanceTimersByTime(10000);
      expect(manager.getEvaluation()).toEqual({ result: false });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should not re-evaluate for a disabled condition', () => {
      createManager({ conditions: [{ ...doorOpenFor5s, enabled: false }] });

      expect(vi.getTimerCount()).toBe(0);
    });

    it('should not re-evaluate for a condition after a failing one', () => {
      createManager({
        conditions: [
          { condition: 'fullscreen' as const, fullscreen: true },
          doorOpenFor5s,
        ],
      });

      expect(vi.getTimerCount()).toBe(0);
    });

    it('should not leave a timer behind when destroyed', () => {
      const manager = createManager();
      expect(vi.getTimerCount()).toBe(1);

      manager.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('should handle listeners correctly', () => {
    it('should add listener', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        templateManager,
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toHaveBeenCalledWith({ result: true }, expect.anything());
      expect(listener).toHaveBeenCalledTimes(1);

      stateManager.setState({ fullscreen: false });
      expect(listener).toHaveBeenCalledWith({ result: false }, expect.anything());
      expect(listener).toHaveBeenCalledTimes(2);

      // Re-add the same listener (will still only be called once).
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toHaveBeenCalledWith({ result: true }, expect.anything());
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('should remove listener', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        templateManager,
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);
      manager.removeListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove listener on destroy', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        templateManager,
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);
      manager.destroy();

      stateManager.setState({ fullscreen: true });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not call listeners when the condition result does not change', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'view' as const, views: ['live'] }],
        templateManager,
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);

      stateManager.setState({ view: 'live' });
      expect(listener).toHaveBeenCalledTimes(1);

      stateManager.setState({ view: 'clip' });
      expect(listener).toHaveBeenCalledTimes(2);

      stateManager.setState({ view: 'clip' });
      expect(listener).toHaveBeenCalledTimes(2);

      stateManager.setState({ view: 'live' });
      expect(listener).toHaveBeenCalledTimes(3);

      stateManager.setState({ view: 'live' });
      expect(listener).toHaveBeenCalledTimes(3);
    });
  });

  describe('enabled', () => {
    const ENABLED_TEMPLATE = '{{ is_state("binary_sensor.flag", "on") }}';

    // These cases gate on a rendered `enabled` template, so use a real engine
    // loaded for the synchronous renderer (rather than the shared mock).
    const templateManager = new TemplateManager();
    beforeAll(async () => {
      stubConnectedHomeAssistant();
      await templateManager.loadRenderer();
    });

    it('should ignore a disabled condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true, enabled: false }],
        templateManager,
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
        templateManager,
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
        templateManager,
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
        templateManager,
        stateManager,
      );

      stateManager.setState({ fullscreen: false });

      expect(manager.getEvaluation()).toEqual({ result: false });
    });

    it('should keep a condition enabled when its template cannot render without hass', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [
          {
            condition: 'fullscreen' as const,
            fullscreen: true,
            enabled: ENABLED_TEMPLATE,
          },
        ],
        templateManager,
        stateManager,
      );

      stateManager.setState({ fullscreen: false });

      // With no hass the enabled template cannot render, so the gate stays
      // enabled and the condition is evaluated (here: fullscreen is false).
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
        templateManager,
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
