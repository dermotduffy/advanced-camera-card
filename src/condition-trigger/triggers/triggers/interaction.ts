import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

export class InteractionTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'interaction'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.interaction;
  }
}
