import { ConditionState } from '../../conditions/types';
import { CardStateTriggerBase } from './card-state-base';
import { TriggerOfType } from './types';

// Triggers when the selected view changes. With `views`, only a change to a
// listed view triggers (including a move between two listed views); without
// `views`, any view change will trigger.
export class ViewTrigger extends CardStateTriggerBase<TriggerOfType<'view'>> {
  protected _shouldTrigger(oldState: ConditionState, newState: ConditionState): boolean {
    const oldView = oldState.view;
    const newView = newState.view;
    if (oldView === newView) {
      return false;
    }
    const views = this._trigger.views;
    return !views?.length || (!!newView && views.includes(newView));
  }
}
