import { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class NotConditionEvaluator extends CompositeConditionEvaluator {
  // "Not" is an inverted `or` (NOR): true when no child matches, reporting a
  // change edge when any child's watched input moved (as `and`/`or` do).
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    let matched = false;
    let changed = false;
    for (const child of this._children) {
      const evaluation = child.evaluate(newState, oldState);
      matched = matched || evaluation.result;
      changed = changed || !!evaluation.changed;
    }
    return { result: !matched, changed };
  }
}
