import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class CameraConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'camera'>;

  constructor(condition: ConditionOfType<'camera'>) {
    this._condition = condition;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    const oldCamera = oldState?.camera;
    const newCamera = newState?.camera;
    const changed = newCamera !== oldCamera;

    return {
      result:
        (!!newCamera && !!this._condition.cameras?.includes(newCamera)) ||
        (changed && !this._condition.cameras?.length),
      changed,
    };
  }
}
