import { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class NotConditionEvaluator extends CompositeConditionEvaluator {
  // "Not" is an inverted `or` (NOR). There is no trigger data for "not
  // triggering".
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    return {
      result: !this._children.some((child) => child.evaluate(newState, oldState).result),
    };
  }
}
