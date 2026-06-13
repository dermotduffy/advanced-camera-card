import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class ViewConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'view'>;

  constructor(condition: ConditionOfType<'view'>) {
    this._condition = condition;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    const oldView = oldState?.view;
    const newView = newState?.view;
    const changed = oldView !== newView;

    return {
      result:
        (!!newView && this._condition.views?.includes(newView)) ||
        (changed && !this._condition.views?.length),
      changed,
    };
  }
}
