import { HassEntity } from 'home-assistant-js-websocket';
import { isEqual } from 'lodash-es';
import { arrayify } from '../../../utils/basic';
import { Timer } from '../../../utils/timer';
import { renderTimePeriodToSeconds } from '../../common/time-period';
import { ConditionStateChange } from '../../conditions/types';
import {
  TriggerCallback,
  TriggerEvaluator,
  TriggerEvaluatorContext,
  TriggerOfType,
} from './types';

// Shared scaffolding for the stock entity triggers (`state` and
// `numeric_state`): per-`entity`/`entity_id` fan-out, the `for:` hold (one
// Timer per entity), and the HA-faithful trigger payload. Subclasses implement
// only the per-entity decision (`_processEntity`) and their `platform`.
export abstract class EntityStateTriggerBase<
  T extends TriggerOfType<'state'> | TriggerOfType<'numeric_state'>,
> implements TriggerEvaluator
{
  protected _trigger: T;
  protected _context: TriggerEvaluatorContext;

  private _callback: TriggerCallback | null = null;

  // A `for:` hold per entity: a list can be holding several independently.
  private _forTimers = new Map<string, Timer>();

  // The `trigger.platform` value reported in the trigger payload.
  protected abstract readonly _platform: string;

  constructor(trigger: T, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;
    this._onSubscribe();
    this._context.stateManager.addListener(this._stateChangehandler);
  }

  public destroy(): void {
    this._context.stateManager.removeListener(this._stateChangehandler);
    this._forTimers.forEach((timer) => timer.stop());
    this._forTimers.clear();
    this._onDestroy();
    this._callback = null;
  }

  protected abstract _processEntityChange(
    entityID: string,
    oldStateObj: HassEntity | undefined,
    newStateObj: HassEntity | undefined,
  ): void;

  protected _onSubscribe(): void {}
  protected _onDestroy(): void {}

  protected _entityIDs(): string[] {
    return arrayify(this._trigger.entity_id ?? this._trigger.entity);
  }

  // Cancel a pending `for:` hold for an entity that left its matching condition.
  protected _cancelForTimer(entityID: string): void {
    this._forTimers.get(entityID)?.stop();
  }

  // Trigger immediately, or arm the `for:` hold so it triggers only after the
  // condition has held for the configured duration.
  protected _callTriggerOrHold(
    entityID: string,
    oldStateObj?: HassEntity,
    newStateObj?: HassEntity,
  ): void {
    if (!this._trigger.for) {
      this._callTrigger(entityID, oldStateObj, newStateObj);
      return;
    }
    const seconds = renderTimePeriodToSeconds(
      this._context.templateRenderer,
      this._trigger.for,
      this._context.stateManager.getState(),
    );
    if (seconds !== null) {
      this._getForTimer(entityID).start(seconds, () =>
        this._callTrigger(entityID, oldStateObj, newStateObj),
      );
    }
  }

  private _stateChangehandler = (change: ConditionStateChange): void => {
    for (const entityID of this._entityIDs()) {
      const oldStateObj = change.old.hass?.states?.[entityID];
      const newStateObj = change.new.hass?.states?.[entityID];

      // Only entities whose state object actually changed are candidates.
      if (isEqual(oldStateObj, newStateObj)) {
        continue;
      }
      this._processEntityChange(entityID, oldStateObj, newStateObj);
    }
  };

  private _getForTimer(entityID: string): Timer {
    let timer = this._forTimers.get(entityID);
    if (!timer) {
      timer = new Timer();
      this._forTimers.set(entityID, timer);
    }
    return timer;
  }

  private _callTrigger(
    entityID: string,
    oldStateObj?: HassEntity,
    newStateObj?: HassEntity,
  ): void {
    this._callback?.({
      platform: this._platform,
      entity_id: entityID,
      entity: entityID,
      ...(oldStateObj && { from_state: oldStateObj }),
      ...(newStateObj && { to_state: newStateObj }),
    });
  }
}
