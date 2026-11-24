import { mock, type MockProxy } from 'vitest-mock-extended';

import type {
  ConditionEvaluator,
  EvaluatorContext,
} from '../../../../src/condition-trigger/conditions/conditions/types';
import { createMockTemplateRenderer } from '../../../test-utils';

export const createEvaluatorContext = (
  context?: Partial<EvaluatorContext>,
): EvaluatorContext => ({
  templateRenderer: createMockTemplateRenderer(),
  ...context,
});

export const createMockEvaluator = (
  result: boolean,
  validUntil?: Date,
): MockProxy<ConditionEvaluator> => {
  const evaluator = mock<ConditionEvaluator>();
  evaluator.evaluate.mockReturnValue(validUntil ? { result, validUntil } : { result });
  return evaluator;
};
