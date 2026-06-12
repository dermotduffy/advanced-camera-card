import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { TemplateTrigger } from '../../../../src/condition-trigger/triggers/triggers/template';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createHASS, createStateEntity } from '../../../test-utils';

const ENTITY_ONE = 'sensor.foo';
const ENTITY_TWO = 'sensor.bar';

const ENTITY_ONE_ON_TEMPLATE = `{{ is_state("${ENTITY_ONE}", "on") }}`;

// @vitest-environment jsdom
describe('TemplateTrigger', () => {
  const create = (
    config: TriggerOfType<'template'>,
  ): {
    trigger: TemplateTrigger;
    stateManager: ConditionStateManager;
    onFire: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const onFire = vi.fn();
    const trigger = new TemplateTrigger(config, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    });
    return { trigger, stateManager, onFire };
  };

  const setSensor = (manager: ConditionStateManager, state: string): void => {
    manager.setState({
      hass: createHASS({ [ENTITY_ONE]: createStateEntity({ state }) }),
    });
  };

  it('should fire on the rising edge to true', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(onFire);

    setSensor(stateManager, 'off');
    expect(onFire).not.toHaveBeenCalled();

    setSensor(stateManager, 'on');
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith({ platform: 'template' });
  });

  it('should not fire when the template is already true at subscribe', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    setSensor(stateManager, 'on');
    trigger.subscribe(onFire);

    // A later change that keeps the template true must not fire.
    stateManager.setState({
      hass: createHASS({
        [ENTITY_ONE]: createStateEntity({ state: 'on' }),
        [ENTITY_TWO]: createStateEntity({ state: 'x' }),
      }),
    });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should not re-fire while the template remains true', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(onFire);

    setSensor(stateManager, 'on');
    expect(onFire).toHaveBeenCalledTimes(1);

    stateManager.setState({
      hass: createHASS({
        [ENTITY_ONE]: createStateEntity({ state: 'on' }),
        [ENTITY_TWO]: createStateEntity({ state: 'y' }),
      }),
    });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should fire again after returning to false then true', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(onFire);

    setSensor(stateManager, 'on');
    setSensor(stateManager, 'off');
    setSensor(stateManager, 'on');
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('should fire immediately when "for" is zero', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
      for: 0,
    });
    trigger.subscribe(onFire);

    setSensor(stateManager, 'on');
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  describe('for', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should fire only after the template has held true for the duration', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'template',
        value_template: ENTITY_ONE_ON_TEMPLATE,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setSensor(stateManager, 'on');
      vi.advanceTimersByTime(4999);
      expect(onFire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should cancel the pending fire when the template goes false before the duration', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'template',
        value_template: ENTITY_ONE_ON_TEMPLATE,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setSensor(stateManager, 'on');
      vi.advanceTimersByTime(3000);
      setSensor(stateManager, 'off');
      vi.advanceTimersByTime(5000);
      expect(onFire).not.toHaveBeenCalled();
    });

    it('should not fire when "for" is unparseable', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'template',
        value_template: ENTITY_ONE_ON_TEMPLATE,
        for: 'not-a-duration',
      });
      trigger.subscribe(onFire);

      setSensor(stateManager, 'on');
      vi.advanceTimersByTime(100000);
      expect(onFire).not.toHaveBeenCalled();
    });
  });

  it('should stop firing after destroy', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(onFire);
    trigger.destroy();

    setSensor(stateManager, 'on');
    expect(onFire).not.toHaveBeenCalled();
  });
});
