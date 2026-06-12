import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class ExpandConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'expand'>;

  constructor(condition: ConditionOfType<'expand'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        newState?.expand !== undefined && this._condition.expand === newState.expand,
    };
  }
}
