import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class DisplayModeConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'display_mode'>;

  constructor(condition: ConditionOfType<'display_mode'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        !!newState?.displayMode && this._condition.display_mode === newState.displayMode,
    };
  }
}
