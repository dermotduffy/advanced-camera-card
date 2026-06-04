import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class MicrophoneConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'microphone'>;

  constructor(condition: ConditionOfType<'microphone'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: newState?.microphone?.muted === this._condition.muted,
    };
  }
}
