import { describe, expect, it } from 'vitest';
import { TemplateRenderer } from '../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import { createTriggerEvaluator } from '../../../src/condition-trigger/triggers/factory';
import { CameraTrigger } from '../../../src/condition-trigger/triggers/triggers/camera';
import { ConditionRisingEdgeTrigger } from '../../../src/condition-trigger/triggers/triggers/condition-rising-edge';
import { ConfigTrigger } from '../../../src/condition-trigger/triggers/triggers/config';
import { NumericStateTrigger } from '../../../src/condition-trigger/triggers/triggers/numeric-state';
import { StateTrigger } from '../../../src/condition-trigger/triggers/triggers/state';
import { TemplateTrigger } from '../../../src/condition-trigger/triggers/triggers/template';
import { TriggerEvaluatorContext } from '../../../src/condition-trigger/triggers/triggers/types';
import { ViewTrigger } from '../../../src/condition-trigger/triggers/triggers/view';
import { Trigger } from '../../../src/config/schema/condition-trigger/triggers/types';

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

  it('should create a CameraTrigger for a camera trigger', () => {
    expect(
      createTriggerEvaluator({ trigger: 'camera', cameras: ['front'] }, context()),
    ).toBeInstanceOf(CameraTrigger);
  });

  it('should create a ViewTrigger for a view trigger', () => {
    expect(
      createTriggerEvaluator({ trigger: 'view', views: ['live'] }, context()),
    ).toBeInstanceOf(ViewTrigger);
  });

  it('should create a ConfigTrigger for a config trigger', () => {
    expect(createTriggerEvaluator({ trigger: 'config' }, context())).toBeInstanceOf(
      ConfigTrigger,
    );
  });

  // Every card-specific trigger that is not its own dedicated class
  // (camera/view/config) falls through to the rising-edge trigger.
  it.each<Trigger>([
    { trigger: 'call', call: true },
    { trigger: 'display_mode', display_mode: 'single' },
    { trigger: 'expand', expand: true },
    { trigger: 'fullscreen', fullscreen: true },
    { trigger: 'initialized' },
    { trigger: 'interaction', interaction: true },
    { trigger: 'key', key: 'a' },
    { trigger: 'media_loaded', media_loaded: true },
    { trigger: 'microphone', muted: true },
    { trigger: 'screen' },
    { trigger: 'triggered' },
  ])('should create a ConditionRisingEdgeTrigger for a $trigger trigger', (trigger) => {
    expect(createTriggerEvaluator(trigger, context())).toBeInstanceOf(
      ConditionRisingEdgeTrigger,
    );
  });
});
