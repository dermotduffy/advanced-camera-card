import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

export class KeyTrigger extends ConditionStateTriggerBase<TriggerOfType<'key'>> {
  protected _getValue(state: ConditionState): unknown {
    return state.keys;
  }
}
