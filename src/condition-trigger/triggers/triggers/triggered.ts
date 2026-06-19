import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

export class TriggeredTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'triggered'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.triggered;
  }
}
