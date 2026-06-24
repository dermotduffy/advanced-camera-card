import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class InitializedConditionEvaluator implements ConditionEvaluator {
  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return { result: !!newState?.initialized };
  }
}
