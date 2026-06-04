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

    return {
      result:
        (!!newCamera && !!this._condition.cameras?.includes(newCamera)) ||
        (newCamera !== oldCamera && !this._condition.cameras?.length),
      ...(newCamera !== oldCamera && {
        triggerData: {
          ...((oldState?.camera || newState?.camera) && {
            camera: {
              ...(oldState?.camera && { from: oldState?.camera }),
              ...(newState?.camera && { to: newState?.camera }),
            },
          }),
        },
      }),
    };
  }
}
