import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class KeyConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'key'>;

  constructor(condition: ConditionOfType<'key'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const condition = this._condition;
    return {
      result:
        !!newState?.keys &&
        condition.key in newState.keys &&
        (condition.state ?? 'down') === newState.keys[condition.key].state &&
        (condition.ctrl === undefined ||
          condition.ctrl === !!newState.keys[condition.key].ctrl) &&
        (condition.alt === undefined ||
          condition.alt === !!newState.keys[condition.key].alt) &&
        (condition.meta === undefined ||
          condition.meta === !!newState.keys[condition.key].meta) &&
        (condition.shift === undefined ||
          condition.shift === !!newState.keys[condition.key].shift),
    };
  }
}
