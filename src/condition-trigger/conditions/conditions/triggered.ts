import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class TriggeredConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'triggered'>;

  constructor(condition: ConditionOfType<'triggered'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: this._condition.triggered.some((triggeredCameraID) =>
        newState?.triggered?.has(triggeredCameraID),
      ),
    };
  }
}
