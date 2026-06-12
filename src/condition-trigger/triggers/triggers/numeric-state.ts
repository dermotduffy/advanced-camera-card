import { HassEntity } from 'home-assistant-js-websocket';
import { matchesNumericState, readNumericStateValue } from '../../common/numeric-state';
import { ConditionState } from '../../conditions/types';
import { EntityStateTrigger } from './entity-state';
import { TriggerOfType } from './types';

// https://www.home-assistant.io/docs/automation/trigger/#numeric-state-trigger
// Faithful to HA's numeric_state trigger
// (homeassistant/components/homeassistant/triggers/numeric_state.py): fires on
// the *crossing* into the `above`/`below` range, not while merely in it. Each
// entity is "armed" while outside the range and fires once on the transition
// in, then disarms until it leaves and re-arms. `for:` holds the fire only
// while the value stays in range. The in-range check is shared with the
// numeric_state condition (`matchesNumericState`).
export class NumericStateTrigger extends EntityStateTrigger<
  TriggerOfType<'numeric_state'>
> {
  protected readonly _platform = 'numeric_state';

  // Entities currently outside the range, armed to fire on the next crossing in.
  private _armedEntities = new Set<string>();

  protected _onSubscribe(): void {
    // Arm entities that start with a readable value outside the range, matching
    // HA: an unreadable entity is not armed, so it does not fire on its first
    // valid in-range reading (only once it has been outside and crossed in).
    const state = this._context.stateManager.getState();
    for (const entityID of this._entityIDs()) {
      if (
        readNumericStateValue(
          entityID,
          state,
          this._trigger,
          this._context.templateRenderer,
        ) !== null &&
        !this._matches(entityID, state)
      ) {
        this._armedEntities.add(entityID);
      }
    }
  }

  protected _onDestroy(): void {
    this._armedEntities.clear();
  }

  private _matches(entityID: string, state: ConditionState): boolean {
    return matchesNumericState(
      entityID,
      state,
      this._trigger,
      this._context.templateRenderer,
    );
  }

  protected _processEntityChange(
    entityID: string,
    oldStateObj: HassEntity | undefined,
    newStateObj: HassEntity | undefined,
  ): void {
    // During a state-change dispatch the manager's stored state is already the
    // new state, so it is what this entity just changed to.
    if (!this._matches(entityID, this._context.stateManager.getState())) {
      // Outside the range: (re-)arm, and cancel any pending `for:` hold.
      this._armedEntities.add(entityID);
      this._cancelForTimer(entityID);
      return;
    }

    // Inside the range but not armed: already in range, so not a crossing.
    if (!this._armedEntities.has(entityID)) {
      return;
    }

    // Crossing into the range: disarm and fire (or start the `for:` hold).
    this._armedEntities.delete(entityID);
    this._fireOrHold(entityID, oldStateObj, newStateObj);
  }
}
