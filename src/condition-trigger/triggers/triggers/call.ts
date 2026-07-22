import { CallConditionEvaluator } from '../../conditions/conditions/call';
import type { ConditionState } from '../../conditions/types';
import {
  ConditionStateTriggerBase,
  type TransitionEvaluators,
} from './condition-state-base';
import type { TriggerOfType } from './types';

export class CallTrigger extends ConditionStateTriggerBase<TriggerOfType<'call'>> {
  protected _getValue(state: ConditionState): unknown {
    return state.call ?? 'idle';
  }

  // `from` and `to` are matched with the call condition's own evaluator, so the
  // trigger and the condition share one definition of what a phase means.
  protected _createTransitionEvaluators(): TransitionEvaluators {
    const from = this._trigger.from;
    const to = this._trigger.to;
    return {
      ...(from !== undefined && { from: new CallConditionEvaluator({ call: from }) }),
      ...(to !== undefined && { to: new CallConditionEvaluator({ call: to }) }),
    };
  }
}
