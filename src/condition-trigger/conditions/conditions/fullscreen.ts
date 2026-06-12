import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class FullscreenConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'fullscreen'>;

  constructor(condition: ConditionOfType<'fullscreen'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        newState?.fullscreen !== undefined &&
        this._condition.fullscreen === newState.fullscreen,
    };
  }
}
