import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

// Triggers when the selected camera changes: to one of `cameras` if listed, to
// no camera if `cameras` is `[]`, or on any change if `cameras` is omitted.
export class CameraTrigger extends ConditionStateTriggerBase<TriggerOfType<'camera'>> {
  protected _getValue(state: ConditionState): unknown {
    return state.camera;
  }
}
