import type { FullscreenBase } from '../../../config/schema/condition-trigger/common/fullscreen';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class FullscreenConditionEvaluator implements ConditionEvaluator {
  private _condition: FullscreenBase;

  constructor(condition: FullscreenBase) {
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
