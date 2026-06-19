import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

export class FullscreenTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'fullscreen'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.fullscreen;
  }
}
