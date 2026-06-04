import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class UserConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'user'>;

  constructor(condition: ConditionOfType<'user'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        !!newState?.hass?.user && this._condition.users.includes(newState.hass.user.id),
    };
  }
}
