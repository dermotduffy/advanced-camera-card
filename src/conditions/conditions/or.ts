import { ConditionsEvaluationResult, ConditionState } from '../types';
import { CompositeConditionEvaluator } from './composite';

export class OrConditionEvaluator extends CompositeConditionEvaluator {
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    for (const child of this._children) {
      const evaluation = child.evaluate(newState, oldState);
      if (evaluation.result) {
        return evaluation;
      }
    }
    return { result: false };
  }
}
