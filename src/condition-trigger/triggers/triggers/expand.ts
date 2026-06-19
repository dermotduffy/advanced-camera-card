import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

export class ExpandTrigger extends ConditionStateTriggerBase<TriggerOfType<'expand'>> {
  protected _getValue(state: ConditionState): unknown {
    return state.expand;
  }
}
