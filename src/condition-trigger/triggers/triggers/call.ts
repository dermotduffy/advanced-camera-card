import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

export class CallTrigger extends ConditionStateTriggerBase<TriggerOfType<'call'>> {
  protected _getValue(state: ConditionState): unknown {
    const call = state.call ?? { active: false, answered: false };
    // Only watch `answered` when the trigger config cares about it -- keeps
    // a plain `call: true`/`call: false` trigger firing solely on the
    // active/inactive edge, unaffected by an answer happening mid-call.
    return this._trigger.answered === undefined ? call.active : call;
  }
}
