import { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class AndConditionEvaluator extends CompositeConditionEvaluator {
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    let changed = false;
    for (const child of this._children) {
      const evaluation = child.evaluate(newState, oldState);
      if (!evaluation.result) {
        return { result: false };
      }
      changed = changed || !!evaluation.changed;
    }
    return { result: true, changed };
  }
}
