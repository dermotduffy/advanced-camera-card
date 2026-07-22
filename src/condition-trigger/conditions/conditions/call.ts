import type { CallBase } from '../../../config/schema/condition-trigger/common/call';
import { arrayify } from '../../../utils/basic';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class CallConditionEvaluator implements ConditionEvaluator {
  private _condition: CallBase;

  constructor(condition: CallBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: arrayify(this._condition.call).includes(newState?.call ?? 'idle'),
    };
  }
}
