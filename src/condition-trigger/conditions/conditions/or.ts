import type { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class OrConditionEvaluator extends CompositeConditionEvaluator {
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    for (const child of this._children) {
      if (child.evaluate(newState, oldState).result) {
        return { result: true };
      }
    }
    return { result: false };
  }
}
