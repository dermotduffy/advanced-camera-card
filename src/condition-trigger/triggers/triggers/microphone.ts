import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

// Triggers when the microphone mute state changes: to the given value if `muted`
// is set, or on any change if it is omitted.
export class MicrophoneTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'microphone'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.microphone?.muted;
  }
}
