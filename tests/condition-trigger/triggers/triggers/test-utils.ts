import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { TriggerEvaluatorContext } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createHASSManager } from '../../../test-utils';

export const createTriggerEvaluatorContext = (
  context?: Partial<TriggerEvaluatorContext>,
): TriggerEvaluatorContext => ({
  stateManager: new ConditionStateManager(),
  templateRenderer: new TemplateRenderer(),
  hassManager: createHASSManager(),
  ...context,
});
