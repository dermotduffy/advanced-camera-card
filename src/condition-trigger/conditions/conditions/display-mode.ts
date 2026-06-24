import type { DisplayModeBase } from '../../../config/schema/condition-trigger/common/display-mode';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class DisplayModeConditionEvaluator implements ConditionEvaluator {
  private _condition: DisplayModeBase;

  constructor(condition: DisplayModeBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        !!newState?.displayMode && this._condition.display_mode === newState.displayMode,
    };
  }
}
