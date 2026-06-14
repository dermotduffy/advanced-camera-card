import { ConditionState } from '../../conditions/types';
import { CardStateTriggerBase } from './card-state-base';
import { TriggerOfType } from './types';

// Triggers when the selected camera changes: to one of `cameras` if listed, to
// no camera if `cameras` is `[]`, or on any change if `cameras` is omitted.
export class CameraTrigger extends CardStateTriggerBase<TriggerOfType<'camera'>> {
  protected _shouldTrigger(oldState: ConditionState, newState: ConditionState): boolean {
    const oldCamera = oldState.camera;
    const newCamera = newState.camera;
    if (oldCamera === newCamera) {
      return false;
    }
    const cameras = this._trigger.cameras;
    if (cameras === undefined) {
      return true;
    }
    if (cameras.length === 0) {
      return !newCamera;
    }
    return !!newCamera && cameras.includes(newCamera);
  }
}
