import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

// Triggers when the selected view changes: to one of `views` if listed, or on
// any change if `views` is omitted.
export class ViewTrigger extends ConditionStateTriggerBase<TriggerOfType<'view'>> {
  protected _getValue(state: ConditionState): unknown {
    return state.view;
  }
}
