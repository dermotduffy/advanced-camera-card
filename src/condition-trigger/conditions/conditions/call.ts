import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class CallConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'call'>;

  constructor(condition: ConditionOfType<'call'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: this._condition.call === (newState?.call ?? false),
    };
  }
}
