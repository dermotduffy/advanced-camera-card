import type { ConditionsEvaluationResult, ConditionState } from '../types';
import { isTemplateTrue } from './is-template-true';
import type { ConditionEvaluator, ConditionOfType, EvaluatorContext } from './types';

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
        // Until the renderer has loaded the template cannot be evaluated; fail
        // (rather than render a raw `{{…}}`), and re-evaluate once it loads.
        this._context.templateRenderer.isLoaded() &&
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
