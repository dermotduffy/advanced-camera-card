import { isEqual } from 'lodash-es';
import { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import { ConditionEvaluator } from '../../conditions/conditions/types';
import { createConditionEvaluatorForTrigger } from '../../conditions/factory';
import { ConditionState, ConditionStateChange } from '../../conditions/types';
import { buildCardTriggerData } from '../build-trigger-data';
import { TriggerCallback, TriggerEvaluator, TriggerEvaluatorContext } from './types';

// A trigger driven by `ConditionState` changes: subscribe to the state manager,
// fire when the watched value (`_getValue`) changes and the new state passes
// the trigger's condition, and emit the `acc` payload. The condition is the
// matching condition reused as a point-in-time predicate -- so a trigger and
// its condition share one definition of meaning. A trigger with no value (any
// change), or no matching condition (`config`), has no condition to pass.
export abstract class ConditionStateTriggerBase<T extends Trigger>
  implements TriggerEvaluator
{
  protected _trigger: T;
  protected _context: TriggerEvaluatorContext;

  private _callback: TriggerCallback | null = null;
  private _condition: ConditionEvaluator | null;

  constructor(trigger: T, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;

    // The condition the trigger checks each change against.
    this._condition = createConditionEvaluatorForTrigger(trigger);
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;
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
    this._callback?.(buildCardTriggerData(this._trigger.trigger, change));
  };

  // The slice of state this trigger watches; it fires only when this changes.
  protected abstract _getValue(state: ConditionState): unknown;
}
