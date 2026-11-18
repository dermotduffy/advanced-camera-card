import type { ReadonlyDeep } from 'type-fest';

import type { InteractionBase } from '../../../config/schema/condition-trigger/common/interaction';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class InteractionConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<InteractionBase>;

  constructor(condition: ReadonlyDeep<InteractionBase>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        newState?.interaction !== undefined &&
        this._condition.interaction === newState.interaction,
    };
  }
}
