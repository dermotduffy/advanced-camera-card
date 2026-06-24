import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

export class DisplayModeTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'display_mode'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.displayMode;
  }
}
