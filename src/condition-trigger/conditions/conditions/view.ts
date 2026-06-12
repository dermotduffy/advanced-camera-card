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

    return {
      result:
        (!!newView && this._condition.views?.includes(newView)) ||
        (newView !== oldView && !this._condition.views?.length),
      ...(oldView !== newView && {
        triggerData: {
          ...((oldState?.view || newState?.view) && {
            view: {
              ...(oldState?.view && { from: oldState.view }),
              ...(newState?.view && { to: newState.view }),
            },
          }),
        },
      }),
    };
  }
}
