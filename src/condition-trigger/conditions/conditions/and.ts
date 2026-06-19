import { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class AndConditionEvaluator extends CompositeConditionEvaluator {
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    for (const child of this._children) {
      if (!child.evaluate(newState, oldState).result) {
        return { result: false };
      }
    }
    return { result: true };
  }
}
