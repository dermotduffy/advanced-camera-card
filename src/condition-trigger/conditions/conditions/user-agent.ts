import { isBeingCasted } from '../../../utils/casting';
import { isCompanionApp } from '../../../utils/companion';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class UserAgentConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'user_agent'>;

  constructor(condition: ConditionOfType<'user_agent'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const condition = this._condition;
    return {
      result:
        !!newState?.userAgent &&
        (!condition.user_agent || condition.user_agent === newState.userAgent) &&
        (condition.casting === undefined ||
          condition.casting === isBeingCasted(newState.userAgent)) &&
        (condition.companion === undefined ||
          condition.companion === isCompanionApp(newState.userAgent)) &&
        (condition.user_agent_re === undefined ||
          new RegExp(condition.user_agent_re).test(newState.userAgent)),
    };
  }
}
