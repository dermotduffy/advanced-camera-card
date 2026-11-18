import type { ReadonlyDeep } from 'type-fest';

import type { ExpandBase } from '../../../config/schema/condition-trigger/common/expand';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class ExpandConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<ExpandBase>;

  constructor(condition: ReadonlyDeep<ExpandBase>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        newState?.expand !== undefined && this._condition.expand === newState.expand,
    };
  }
}
