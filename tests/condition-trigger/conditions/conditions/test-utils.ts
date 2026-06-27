import type { EvaluatorContext } from '../../../../src/condition-trigger/conditions/conditions/types';
import { createMockTemplateRenderer } from '../../../test-utils';

export const createEvaluatorContext = (
  context?: Partial<EvaluatorContext>,
): EvaluatorContext => ({
  templateRenderer: createMockTemplateRenderer(),
  ...context,
});
