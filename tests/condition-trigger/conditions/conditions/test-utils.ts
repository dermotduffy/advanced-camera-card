import { TemplateRenderer } from '../../../../src/card-controller/templates';
import type { EvaluatorContext } from '../../../../src/condition-trigger/conditions/conditions/types';

export const createEvaluatorContext = (): EvaluatorContext => ({
  templateRenderer: new TemplateRenderer(),
});
