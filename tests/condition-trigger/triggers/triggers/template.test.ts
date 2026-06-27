import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { TemplateManager } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { TemplateTrigger } from '../../../../src/condition-trigger/triggers/triggers/template';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import {
  createHASS,
  createStateEntity,
  stubConnectedHomeAssistant,
} from '../../../test-utils';
import { createTriggerEvaluatorContext } from './test-utils';

const templateManager = new TemplateManager();
beforeAll(async () => {
  stubConnectedHomeAssistant();
  await templateManager.loadRenderer();
});

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
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const trigger = new TemplateTrigger(
      config,
      createTriggerEvaluatorContext({ stateManager, templateRenderer: templateManager }),
    );
    return { trigger, stateManager, callback };
  };

  const setSensor = (manager: ConditionStateManager, state: string): void => {
    manager.setState({
      hass: createHASS({ [ENTITY_ONE]: createStateEntity({ state }) }),
    });
  };

  it('should trigger on the rising edge to true', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(callback);

    setSensor(stateManager, 'off');
    expect(callback).not.toHaveBeenCalled();

    setSensor(stateManager, 'on');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ platform: 'template' });
  });

  it('should not trigger when the template is already true at subscribe', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    setSensor(stateManager, 'on');
    trigger.subscribe(callback);

    // A later change that keeps the template true must not trigger.
    stateManager.setState({
      hass: createHASS({
        [ENTITY_ONE]: createStateEntity({ state: 'on' }),
        [ENTITY_TWO]: createStateEntity({ state: 'x' }),
      }),
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not re-trigger while the template remains true', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(callback);

    setSensor(stateManager, 'on');
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({
      hass: createHASS({
        [ENTITY_ONE]: createStateEntity({ state: 'on' }),
        [ENTITY_TWO]: createStateEntity({ state: 'y' }),
      }),
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger again after returning to false then true', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(callback);

    setSensor(stateManager, 'on');
    setSensor(stateManager, 'off');
    setSensor(stateManager, 'on');
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger immediately when "for" is zero', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
      for: 0,
    });
    trigger.subscribe(callback);

    setSensor(stateManager, 'on');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  describe('for', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger only after the template has held true for the duration', () => {
      const { trigger, stateManager, callback } = create({
        trigger: 'template',
        value_template: ENTITY_ONE_ON_TEMPLATE,
        for: '00:00:05',
      });
      trigger.subscribe(callback);

      setSensor(stateManager, 'on');
      vi.advanceTimersByTime(4999);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should cancel the pending trigger when the template goes false before the duration', () => {
      const { trigger, stateManager, callback } = create({
        trigger: 'template',
        value_template: ENTITY_ONE_ON_TEMPLATE,
        for: '00:00:05',
      });
      trigger.subscribe(callback);

      setSensor(stateManager, 'on');
      vi.advanceTimersByTime(3000);
      setSensor(stateManager, 'off');
      vi.advanceTimersByTime(5000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not trigger when "for" is unparseable', () => {
      const { trigger, stateManager, callback } = create({
        trigger: 'template',
        value_template: ENTITY_ONE_ON_TEMPLATE,
        for: 'not-a-duration',
      });
      trigger.subscribe(callback);

      setSensor(stateManager, 'on');
      vi.advanceTimersByTime(100000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  it('should stop triggering after destroy', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',
      value_template: ENTITY_ONE_ON_TEMPLATE,
    });
    trigger.subscribe(callback);
    trigger.destroy();

    setSensor(stateManager, 'on');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should trigger on a string-truthy template value for HA symmetry', () => {
    const { trigger, stateManager, callback } = create({
      trigger: 'template',

      // Renders the string "on"/"off", not a boolean; HA treats "on" as true.
      value_template: `{{ "on" if is_state("${ENTITY_ONE}", "on") else "off" }}`,
    });
    trigger.subscribe(callback);

    setSensor(stateManager, 'off');
    expect(callback).not.toHaveBeenCalled();

    setSensor(stateManager, 'on');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
