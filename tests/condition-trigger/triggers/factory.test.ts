import { describe, expect, it } from 'vitest';
import { TemplateRenderer } from '../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createTriggerEvaluator } from '../../../src/condition-trigger/triggers/factory';
import { ACCTrigger } from '../../../src/condition-trigger/triggers/triggers/acc';
import { NumericStateTrigger } from '../../../src/condition-trigger/triggers/triggers/numeric-state';
import { StateTrigger } from '../../../src/condition-trigger/triggers/triggers/state';
import { TemplateTrigger } from '../../../src/condition-trigger/triggers/triggers/template';
import { TriggerEvaluatorContext } from '../../../src/condition-trigger/triggers/triggers/types';

// @vitest-environment jsdom
describe('createTriggerEvaluator', () => {
  const context = (): TriggerEvaluatorContext => ({
    stateManager: new ConditionStateManager(),
    templateRenderer: new TemplateRenderer(),
  });

  it('should create a StateTrigger for a state trigger', () => {
    expect(
      createTriggerEvaluator(
        { trigger: 'state', entity_id: 'binary_sensor.x' },
        context(),
      ),
    ).toBeInstanceOf(StateTrigger);
  });

  it('should create a NumericStateTrigger for a numeric_state trigger', () => {
    expect(
      createTriggerEvaluator(
        { trigger: 'numeric_state', entity_id: 'sensor.x', above: 5 },
        context(),
      ),
    ).toBeInstanceOf(NumericStateTrigger);
  });

  it('should create a TemplateTrigger for a template trigger', () => {
    expect(
      createTriggerEvaluator(
        { trigger: 'template', value_template: '{{ true }}' },
        context(),
      ),
    ).toBeInstanceOf(TemplateTrigger);
  });

  it('should create an ACCTrigger for a card-specific trigger', () => {
    expect(
      createTriggerEvaluator({ trigger: 'camera', cameras: ['front'] }, context()),
    ).toBeInstanceOf(ACCTrigger);
  });
});
