import { InteractionBase } from '../../../config/schema/condition-trigger/common/interaction';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator } from './types';

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
