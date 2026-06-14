import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class ViewConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'view'>;

  constructor(condition: ConditionOfType<'view'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const view = newState?.view;
    return {
      result: !!view && this._condition.views.includes(view),
    };
  }
}
