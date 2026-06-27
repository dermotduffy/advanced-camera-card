import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import type { TriggerEvaluatorContext } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createHASSManager, createMockTemplateRenderer } from '../../../test-utils';

export const createTriggerEvaluatorContext = (
  context?: Partial<TriggerEvaluatorContext>,
): TriggerEvaluatorContext => ({
  stateManager: new ConditionStateManager(),
  templateRenderer: createMockTemplateRenderer(),
  hassManager: createHASSManager(),
  ...context,
});
