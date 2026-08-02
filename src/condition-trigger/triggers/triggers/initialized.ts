import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

export class InitializedTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'initialized'>
> {
  protected _getValue(state: ConditionState): unknown {
    return this._trigger.ever ? state.everInitialized : state.initialized;
  }
}
