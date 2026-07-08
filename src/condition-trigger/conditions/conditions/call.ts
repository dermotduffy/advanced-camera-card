import type { CallBase } from '../../../config/schema/condition-trigger/common/call';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class CallConditionEvaluator implements ConditionEvaluator {
  private _condition: CallBase;

  constructor(condition: CallBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const call = newState?.call;
    const activeMatches =
      this._condition.call === undefined ||
      this._condition.call === (call?.active ?? false);
    const answeredMatches =
      this._condition.answered === undefined ||
      this._condition.answered === (call?.answered ?? false);
    return {
      result: activeMatches && answeredMatches,
    };
  }
}
