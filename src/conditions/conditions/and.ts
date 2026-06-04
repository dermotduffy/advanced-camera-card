import {
  ConditionsEvaluationResult,
  ConditionState,
  ConditionsTriggerData,
} from '../types';
import { CompositeConditionEvaluator } from './composite';

export class AndConditionEvaluator extends CompositeConditionEvaluator {
  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    let triggerData: ConditionsTriggerData = {};
    for (const child of this._children) {
      const evaluation = child.evaluate(newState, oldState);
      if (!evaluation.result) {
        return { result: false };
      }
      triggerData = {
        ...triggerData,
        ...evaluation.triggerData,
      };
    }
    return { result: true, triggerData };
  }
}
