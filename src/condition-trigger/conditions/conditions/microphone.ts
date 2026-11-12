import type { ReadonlyDeep } from 'type-fest';

import type { MicrophoneBase } from '../../../config/schema/condition-trigger/common/microphone';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class MicrophoneConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<MicrophoneBase>;

  constructor(condition: ReadonlyDeep<MicrophoneBase>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        (this._condition.connected === undefined ||
          newState?.microphone?.connected === this._condition.connected) &&
        (this._condition.muted === undefined ||
          newState?.microphone?.muted === this._condition.muted),
    };
  }
}
