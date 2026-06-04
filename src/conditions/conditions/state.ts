import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class StateConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'state'>;

  constructor(condition: ConditionOfType<'state'>) {
    this._condition = condition;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    const condition = this._condition;
    const fromState = oldState?.hass?.states?.[condition.entity]?.state;
    const toState = newState?.hass?.states?.[condition.entity]?.state;

    return {
      result:
        (!condition.state && !condition.state_not && toState !== fromState) ||
        ((!!condition.state || !!condition.state_not) &&
          !!toState &&
          (!condition.state ||
            (Array.isArray(condition.state)
              ? condition.state.includes(toState)
              : condition.state === toState)) &&
          (!condition.state_not ||
            (Array.isArray(condition.state_not)
              ? !condition.state_not.includes(toState)
              : condition.state_not !== toState))),
      ...(fromState !== toState && {
        triggerData: {
          state: {
            entity: condition.entity,
            ...(fromState && { from: fromState }),
            ...(toState && { to: toState }),
          },
        },
      }),
    };
  }
}
