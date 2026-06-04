import { TemplateRenderer } from '../../../src/card-controller/templates';
import { EvaluatorContext } from '../../../src/conditions/conditions/types';

export const createEvaluatorContext = (): EvaluatorContext => ({
  templateRenderer: new TemplateRenderer(),
});
