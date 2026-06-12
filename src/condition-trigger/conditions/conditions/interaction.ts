import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class InteractionConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'interaction'>;

  constructor(condition: ConditionOfType<'interaction'>) {
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
