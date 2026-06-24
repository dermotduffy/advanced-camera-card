import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

export class CallTrigger extends ConditionStateTriggerBase<TriggerOfType<'call'>> {
  protected _getValue(state: ConditionState): unknown {
    return state.call ?? false;
  }
}
