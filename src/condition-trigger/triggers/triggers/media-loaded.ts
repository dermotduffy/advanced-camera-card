import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

export class MediaLoadedTrigger extends ConditionStateTriggerBase<
  TriggerOfType<'media_loaded'>
> {
  protected _getValue(state: ConditionState): unknown {
    return state.mediaLoadedInfo != null;
  }
}
