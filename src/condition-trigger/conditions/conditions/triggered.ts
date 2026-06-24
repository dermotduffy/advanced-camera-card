import type { TriggeredBase } from '../../../config/schema/condition-trigger/common/triggered';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class TriggeredConditionEvaluator implements ConditionEvaluator {
  private _condition: TriggeredBase;

  constructor(condition: TriggeredBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const active = newState?.triggered;
    const cameraIDs = this._condition.triggered;
    const count = active?.size ?? 0;

    let result: boolean;
    if (cameraIDs === undefined) {
      // Omitted: any camera is triggered.
      result = count > 0;
    } else if (cameraIDs.length === 0) {
      // `[]`: no camera is triggered.
      result = count === 0;
    } else {
      // A list: one of the named cameras is among those triggered.
      result = !!active && cameraIDs.some((cameraID) => active.has(cameraID));
    }
    return { result };
  }
}
