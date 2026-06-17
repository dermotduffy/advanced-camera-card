import { CallBase } from '../../../config/schema/condition-trigger/common/call';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator } from './types';

export class CallConditionEvaluator implements ConditionEvaluator {
  private _condition: CallBase;

  constructor(condition: CallBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: this._condition.call === (newState?.call ?? false),
    };
  }
}
