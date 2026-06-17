import { ViewBase } from '../../../config/schema/condition-trigger/common/view';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator } from './types';

export class ViewConditionEvaluator implements ConditionEvaluator {
  private _condition: ViewBase;

  constructor(condition: ViewBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const view = newState?.view;
    return {
      // The condition schema requires `views`; the optional access only guards
      // the shared base type, on which it is declared optional.
      result: !!view && !!this._condition.views?.includes(view),
    };
  }
}
