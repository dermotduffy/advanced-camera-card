import type { ReadonlyDeep } from 'type-fest';

import type { InitializedBase } from '../../../config/schema/condition-trigger/common/initialized';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class InitializedConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<InitializedBase>;

  constructor(condition: ReadonlyDeep<InitializedBase>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: !!(this._condition.ever
        ? newState?.everInitialized
        : newState?.initialized),
    };
  }
}
