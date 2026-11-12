import type { ReadonlyDeep } from 'type-fest';

import type { ViewBase } from '../../../config/schema/condition-trigger/common/view';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class ViewConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<ViewBase>;

  constructor(condition: ReadonlyDeep<ViewBase>) {
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
