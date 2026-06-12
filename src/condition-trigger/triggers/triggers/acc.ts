import { Condition } from '../../../config/schema/condition-trigger/conditions/types';
import { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import { ConditionsManager } from '../../conditions/conditions-manager';
import {
  ConditionsEvaluationResult,
  ConditionState,
  ConditionStateChange,
} from '../../conditions/types';
import { AdvancedCameraCardState, TriggerData } from '../types';
import { TriggerEvaluator, TriggerEvaluatorContext, TriggerFireCallback } from './types';

// The single card-specific trigger path, serving every non-stock trigger
// (`camera`/`view`/`config`/`display_mode`/.../`screen`/`user`). It reuses a
// single-condition `ConditionsManager` (the rising-edge detector) rather than
// reimplementing edge detection, and builds its `from_acc`/`to_acc` trigger
// data from the state change the manager forwards. `platform` is the card provider
// `acc`; `type` carries the specific kind (mirroring HA's device-trigger
// platform/type split).
export class ACCTrigger implements TriggerEvaluator {
  private _trigger: Trigger;
  private _context: TriggerEvaluatorContext;
  private _fireCallback: TriggerFireCallback | null = null;
  private _conditionsManager: ConditionsManager | null = null;

  constructor(trigger: Trigger, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;
  }

  public subscribe(fireCallback: TriggerFireCallback): void {
    this._fireCallback = fireCallback;
    this._conditionsManager = new ConditionsManager(
      [this._toCondition(this._trigger)],
      this._context.stateManager,
    );
    this._conditionsManager.addListener(this._listener);
  }

  public destroy(): void {
    this._conditionsManager?.destroy();
    this._conditionsManager = null;
    this._fireCallback = null;
  }

  private _listener = (
    evaluation: ConditionsEvaluationResult,
    stateChange?: ConditionStateChange,
  ): void => {
    if (!evaluation.result) {
      return;
    }
    this._fireCallback?.(this._buildTriggerData(stateChange));
  };

  // Build the condition equivalent of this card trigger, so it can drive a
  // ConditionsManager.
  //
  // A card trigger and its matching condition are generated from the SAME
  // shared base schema (e.g. `cameraBaseSchema`). The ONLY difference between
  // the two is the discriminator key: (e.g.) a trigger has `trigger: 'camera'`,
  // the condition has `condition: 'camera'`. Every other field is identical. So
  // renaming that one key turns a valid card trigger into a structurally valid
  // card condition, which is exactly what the spread below does.
  //
  // Why the cast is needed: TypeScript cannot type a discriminated-union "key
  // swap". After the spread, `condition` has the type "one of the ~16 kinds" (a
  // union), but every member of the `Condition` union requires `condition` to
  // be a single literal, so the compiler cannot decide which member this is.
  // The only way to satisfy it without a cast is a giant switch that re-lists
  // each literal, which is pure boilerplate and asserts nothing this cast does
  // not.
  //
  // Why it is guaranteed safe (not a hopeful cast): `trigger` was already
  // validated against the trigger schema, and because trigger and condition
  // share the base schema, every non-discriminator field is by construction a
  // valid condition field. The factory only ever routes card triggers here
  // (stock state/numeric/ template triggers go to their own classes), so the
  // swapped discriminator is always a real card-condition kind.
  //
  // Note: There are leftover `trigger`/`enabled` keys ride along but are inert:
  // the `Condition` type cannot reference them and the condition evaluators
  // never read them.
  private _toCondition<T extends Trigger>(
    trigger: T,
  ): Extract<Condition, { condition: T['trigger'] }> {
    const { trigger: kind, ...rest } = trigger;
    return { ...rest, condition: kind } as Extract<
      Condition,
      { condition: T['trigger'] }
    >;
  }

  private _buildTriggerData(stateChange?: ConditionStateChange): TriggerData {
    const data: TriggerData = { platform: 'acc', type: this._trigger.trigger };
    if (!stateChange) {
      return data;
    }
    const from = this._toCardState(stateChange.old);
    const to = this._toCardState(stateChange.new);
    return {
      ...data,
      ...(Object.keys(from).length && { from_acc: from }),
      ...(Object.keys(to).length && { to_acc: to }),
    };
  }

  private _toCardState(state: ConditionState): AdvancedCameraCardState {
    return {
      ...(state.camera !== undefined && { camera: state.camera }),
      ...(state.view !== undefined && { view: state.view }),
      ...(state.config !== undefined && { config: state.config }),
    };
  }
}
