import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

export class InitializedTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'initialized'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.initialized;
  }
}
