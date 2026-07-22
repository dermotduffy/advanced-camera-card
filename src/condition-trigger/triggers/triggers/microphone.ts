import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

// Triggers when the microphone connection or mute state changes: to the given
// values if `connected` / `muted` are set, or on any change if both are
// omitted.
export class MicrophoneTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'microphone'>
> {
  protected _getValue(state: ConditionState): unknown {
    const unconstrained =
      this._trigger.connected === undefined && this._trigger.muted === undefined;

    return {
      ...((unconstrained || this._trigger.connected !== undefined) && {
        connected: state.microphone?.connected,
      }),
      ...((unconstrained || this._trigger.muted !== undefined) && {
        muted: state.microphone?.muted,
      }),
    };
  }
}
