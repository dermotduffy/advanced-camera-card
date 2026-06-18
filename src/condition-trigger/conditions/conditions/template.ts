import { ConditionsEvaluationResult, ConditionState } from '../types';
import { isTemplateTrue } from './is-template-true';
import { ConditionEvaluator, ConditionOfType, EvaluatorContext } from './types';

export class TemplateConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'template'>;
  private _context: EvaluatorContext;

  constructor(condition: ConditionOfType<'template'>, context: EvaluatorContext) {
    this._condition = condition;
    this._context = context;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        !!newState?.hass &&
        isTemplateTrue(
          this._context.templateRenderer.renderRecursively(
            newState.hass,
            this._condition.value_template,
            { conditionState: newState },
          ),
        ),
    };
  }
}
