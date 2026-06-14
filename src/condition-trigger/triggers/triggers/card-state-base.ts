import { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import { ConditionState, ConditionStateChange } from '../../conditions/types';
import { buildCardTriggerData } from '../build-trigger-data';
import { TriggerCallback, TriggerEvaluator, TriggerEvaluatorContext } from './types';

// Shared scaffolding for the card triggers that watch a single facet of the
// card state (e.g. `camera`, `view`) and trigger on a qualifying change.
// Subclasses implement only the per-change decision (`_shouldTrigger`); the
// base owns the state-manager subscription and the `acc` trigger payload
// (`from_acc`/`to_acc` snapshots).
export abstract class CardStateTriggerBase<T extends Trigger>
  implements TriggerEvaluator
{
  protected _trigger: T;
  protected _context: TriggerEvaluatorContext;

  private _callback: TriggerCallback | null = null;

  constructor(trigger: T, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;
    this._context.stateManager.addListener(this._handler);
  }

  public destroy(): void {
    this._context.stateManager.removeListener(this._handler);
    this._callback = null;
  }

  protected abstract _shouldTrigger(
    oldState: ConditionState,
    newState: ConditionState,
  ): boolean;

  private _handler = (change: ConditionStateChange): void => {
    if (!this._shouldTrigger(change.old, change.new)) {
      return;
    }
    this._callback?.(buildCardTriggerData(this._trigger.trigger, change));
  };
}
