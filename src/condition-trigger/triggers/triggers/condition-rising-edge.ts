import { Condition } from '../../../config/schema/condition-trigger/conditions/types';
import { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import { ConditionsManager } from '../../conditions/conditions-manager';
import {
  ConditionsEvaluationResult,
  ConditionStateChange,
} from '../../conditions/types';
import { buildCardTriggerData } from '../build-trigger-data';
import { TriggerCallback, TriggerEvaluator, TriggerEvaluatorContext } from './types';

// Triggers on the rising edge of a single condition. It serves every
// card-specific trigger except `camera`/`view`/`config` (which have dedicated
// classes). It reuses a single-condition `ConditionsManager` (the rising-edge
// detector) rather than reimplementing edge detection, and builds its
// `from_acc`/`to_acc` trigger data from the state change the manager forwards.
// `platform` is the card provider `acc`; `type` carries the specific kind
// (mirroring HA's device-trigger platform/type split).
export class ConditionRisingEdgeTrigger implements TriggerEvaluator {
  private _trigger: Trigger;
  private _context: TriggerEvaluatorContext;
  private _callback: TriggerCallback | null = null;
  private _conditionsManager: ConditionsManager | null = null;

  constructor(trigger: Trigger, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;
    this._conditionsManager = new ConditionsManager(
      [this._toCondition(this._trigger)],
      this._context.stateManager,
    );
    this._conditionsManager.addListener(this._listener);
  }

  public destroy(): void {
    this._conditionsManager?.destroy();
    this._conditionsManager = null;
    this._callback = null;
  }

  private _listener = (
    evaluation: ConditionsEvaluationResult,
    stateChange?: ConditionStateChange,
  ): void => {
    if (!evaluation.result) {
      return;
    }
    this._callback?.(buildCardTriggerData(this._trigger.trigger, stateChange));
  };

  // Build the condition equivalent of this card trigger, so it can drive a
  // ConditionsManager.
  //
  // A card trigger and its matching condition are generated from the SAME
  // shared base schema (e.g. `fullscreenBaseSchema`). The ONLY difference
  // between the two is the discriminator key: a trigger has `trigger:
  // 'fullscreen'`, the condition has `condition: 'fullscreen'`. Every other
  // field is identical (including `enabled`, which both bases carry), so
  // renaming that one key turns a valid card trigger into a structurally valid
  // card condition -- which is exactly what the destructure-and-spread below
  // does.
  //
  // Why the cast is needed: TypeScript cannot type a discriminated-union "key
  // swap". After the spread, `condition` is typed as the union of every trigger
  // kind, but each member of the `Condition` union requires `condition` to be a
  // single literal, so the compiler cannot decide which member this is.
  //
  // Why it is guaranteed safe (not a hopeful cast): `trigger` was already
  // validated against the trigger schema, and because trigger and condition
  // share the base schema, every non-discriminator field is by construction a
  // valid condition field. The factory only ever routes card triggers here
  // (stock state/numeric/template and the dedicated camera/view/config triggers
  // go to their own classes), so the swapped discriminator is always a real
  // card-condition kind. That exclusion is load-bearing for `config`: it is a
  // trigger but NOT a condition, so it must never reach here (and doesn't).
  private _toCondition<T extends Trigger>(
    trigger: T,
  ): Extract<Condition, { condition: T['trigger'] }> {
    const { trigger: kind, ...rest } = trigger;
    return { ...rest, condition: kind } as Extract<
      Condition,
      { condition: T['trigger'] }
    >;
  }
}
