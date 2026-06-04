import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class NumericStateConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'numeric_state'>;

  constructor(condition: ConditionOfType<'numeric_state'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const condition = this._condition;
    return {
      result:
        !!newState?.hass?.states &&
        condition.entity in newState.hass?.states &&
        newState.hass.states[condition.entity].state !== undefined &&
        (condition.above === undefined ||
          Number(newState.hass.states[condition.entity].state) > condition.above) &&
        (condition.below === undefined ||
          Number(newState.hass.states[condition.entity].state) < condition.below),
    };
  }
}
