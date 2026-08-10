import type { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import type { TriggerOfType } from './types';

export class KeyTrigger extends ConditionStateTriggerBase<TriggerOfType<'key'>> {
  protected _getValue(state: ConditionState): unknown {
    const key = this._trigger.key;

    // Without a key the trigger is the any-change form, and watches every key.
    return key === undefined ? state.keys : state.keys?.[key];
  }
}
