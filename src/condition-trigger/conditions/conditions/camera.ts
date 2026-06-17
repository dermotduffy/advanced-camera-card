import { CameraBase } from '../../../config/schema/condition-trigger/common/camera';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator } from './types';

export class CameraConditionEvaluator implements ConditionEvaluator {
  private _condition: CameraBase;

  constructor(condition: CameraBase) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const camera = newState?.camera;
    const cameras = this._condition.cameras;
    if (cameras === undefined) {
      // Omitted: a camera is selected.
      return { result: !!camera };
    }
    if (cameras.length === 0) {
      // `[]`: no camera is selected.
      return { result: !camera };
    }
    // A list: the selected camera is one of these.
    return { result: !!camera && cameras.includes(camera) };
  }
}
