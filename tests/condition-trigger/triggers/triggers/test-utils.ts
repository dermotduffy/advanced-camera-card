import { mock } from 'vitest-mock-extended';
import { HASSManagerReadonlyInterface } from '../../../../src/card-controller/hass/types';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { TriggerEvaluatorContext } from '../../../../src/condition-trigger/triggers/triggers/types';

export const createTriggerEvaluatorContext = (
  context?: Partial<TriggerEvaluatorContext>,
): TriggerEvaluatorContext => ({
  stateManager: new ConditionStateManager(),
  templateRenderer: new TemplateRenderer(),
  hassManager: mock<HASSManagerReadonlyInterface>(),
  ...context,
});
