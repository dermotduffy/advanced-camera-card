import type { MicrophoneBase } from '../../../config/schema/condition-trigger/common/microphone';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class MicrophoneConditionEvaluator implements ConditionEvaluator {
  private _condition: MicrophoneBase;

  constructor(condition: MicrophoneBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result: newState?.microphone?.muted === this._condition.muted,
    };
  }
}
