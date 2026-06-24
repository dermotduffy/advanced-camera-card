import type { InteractionBase } from '../../../config/schema/condition-trigger/common/interaction';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class InteractionConditionEvaluator implements ConditionEvaluator {
  private _condition: InteractionBase;

  constructor(condition: InteractionBase) {
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
