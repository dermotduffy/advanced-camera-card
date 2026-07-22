import { isEqual } from 'lodash-es';

import type { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import type { ConditionEvaluator } from '../../conditions/conditions/types';
import { createConditionEvaluatorForTrigger } from '../../conditions/factory';
import type { ConditionState, ConditionStateChange } from '../../conditions/types';
import { buildCardTriggerData } from '../build-trigger-data';
import type {
  TriggerCallback,
  TriggerEvaluator,
  TriggerEvaluatorContext,
} from './types';

// Evaluators a state change must satisfy: `from` is checked against the state
// before the change, `to` against the state after it. Either may be omitted, in
// which case that check is skipped.
export interface TransitionEvaluators {
  from?: ConditionEvaluator;
  to?: ConditionEvaluator;
}

// A trigger driven by `ConditionState` changes: subscribe to the state manager,
// fire when the watched value (`_getValue`) changes and the new state passes
// the trigger's condition, and emit the `acc` payload. The condition is the
// matching condition reused as a point-in-time predicate -- so a trigger and
// its condition share one definition of meaning. A trigger with no value (any
// change), or no matching condition (`config`), has no condition to pass.
//
// A trigger type may additionally match the change itself rather than only its
// result, by supplying `_createTransitionEvaluators()`. The same condition
// evaluator is then read twice: against the state before the change and the
// state after it.
export abstract class ConditionStateTriggerBase<T extends Trigger>
  implements TriggerEvaluator
{
  protected _trigger: T;
  protected _context: TriggerEvaluatorContext;

  private _callback: TriggerCallback | null = null;
  private _condition: ConditionEvaluator | null = null;
  private _transition: TransitionEvaluators | null = null;

  constructor(trigger: T, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;

    // Both are built here rather than in the constructor, which runs before a
    // subclass has initialized its own fields -- and so before an overridden
    // `_createTransitionEvaluators()` could read them.
    this._condition = createConditionEvaluatorForTrigger(this._trigger);
    this._transition = this._createTransitionEvaluators();

    this._context.stateManager.addListener(this._handler);
  }

  public destroy(): void {
    this._context.stateManager.removeListener(this._handler);
    this._callback = null;
  }

  private _handler = (change: ConditionStateChange): void => {
    if (isEqual(this._getValue(change.old), this._getValue(change.new))) {
      return;
    }
    if (this._condition && !this._condition.evaluate(change.new).result) {
      return;
    }
    const transition = this._transition;
    if (transition?.from && !transition.from.evaluate(change.old).result) {
      return;
    }
    if (transition?.to && !transition.to.evaluate(change.new).result) {
      return;
    }
    this._callback?.(buildCardTriggerData(this._trigger.trigger, change));
  };

  // The slice of state this trigger watches; it fires only when this changes.
  protected abstract _getValue(state: ConditionState): unknown;

  // What the states before and after a change must satisfy, for a trigger type
  // that matches transitions. `null` (the default) matches on the new state
  // alone.
  protected _createTransitionEvaluators(): TransitionEvaluators | null {
    return null;
  }
}
