import type { KeyBase } from '../../../config/schema/condition-trigger/common/key';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class KeyConditionEvaluator implements ConditionEvaluator {
  private _condition: KeyBase;

  constructor(condition: KeyBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const condition = this._condition;

    // The condition schema requires `key`; the undefined check only guards the
    // shared base type, on which it is declared optional.
    if (condition.key === undefined || !newState?.keys?.[condition.key]) {
      return { result: false };
    }
    const pressed = newState.keys[condition.key];
    return {
      result:
        (condition.state ?? 'down') === pressed.state &&
        (condition.ctrl === undefined || condition.ctrl === !!pressed.ctrl) &&
        (condition.alt === undefined || condition.alt === !!pressed.alt) &&
        (condition.meta === undefined || condition.meta === !!pressed.meta) &&
        (condition.shift === undefined || condition.shift === !!pressed.shift),
    };
  }
}
