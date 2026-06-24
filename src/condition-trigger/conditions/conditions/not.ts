import type { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class NotConditionEvaluator extends CompositeConditionEvaluator {
  // "Not" is an inverted `or` (NOR): true when no child matches.
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    for (const child of this._children) {
      if (child.evaluate(newState, oldState).result) {
        return { result: false };
      }
    }
    return { result: true };
  }
}
