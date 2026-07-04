import type { HassEntity } from 'home-assistant-js-websocket';

import { haEqual } from '../../../ha/event-match';
import { arrayifyWithFalsy } from '../../../utils/basic';
import { EntityStateTriggerBase } from './entity-state-base';
import type { TriggerOfType } from './types';

// https://www.home-assistant.io/docs/automation/trigger/#state-trigger Faithful
// to HA's state trigger
// (homeassistant/components/homeassistant/triggers/state.py):
// per-`entity`/`entity_id`, `from`/`to`/`not_from`/`not_to` matchers (absent or
// `null` matches anything), the `match_all` attribute-triggering rule,
// `attribute`, and a per-entity `for:`.
export class StateTrigger extends EntityStateTriggerBase<TriggerOfType<'state'>> {
  protected readonly _platform = 'state';

  // True when any of `from`/`to`/`not_from`/`not_to` is set. A `null` config value
  // (e.g. `to: null`) still counts as set: it matches any state value (see
  // `_matches`), but its mere presence is what restricts triggering to *real
  // state changes*. This is the whole significance of `to: null` vs omitting
  // `to`: both match any value, but `to: null` will NOT trigger on attribute-only
  // changes (a constraint exists), whereas omitting all four triggers on those
  // too.
  private _hasStateConstraint(): boolean {
    const trigger = this._trigger;
    return (
      trigger.from !== undefined ||
      trigger.not_from !== undefined ||
      trigger.to !== undefined ||
      trigger.not_to !== undefined
    );
  }

  // The state (a string) or, when `attribute` is set, the raw attribute value
  // (any type). `null` is the "no value" sentinel for a missing entity or
  // attribute; a genuine attribute value of `0`/`false`/`''` is a real value.
  private _readValue(stateObj?: HassEntity): unknown {
    if (!stateObj) {
      return null;
    }
    const attribute = this._trigger.attribute;
    if (attribute !== undefined) {
      // Own-property check (not `?.[]`) so inherited props like `toString` are
      // not mistaken for attributes; HA collapses a missing key to `None`.
      const attributes = stateObj.attributes;
      return Object.prototype.hasOwnProperty.call(attributes, attribute)
        ? attributes[attribute]
        : null;
    }
    return stateObj.state;
  }

  // Whether `value` is one of a constraint's values (a single value or a list),
  // compared with HA's Python `==` (`haEqual`; for a string state this is plain
  // equality). Falsy values (`0`/`false`/`''`) are kept as real values.
  private _includes(constraint: unknown, value: unknown): boolean {
    return arrayifyWithFalsy(constraint).some((v) => haEqual(v, value));
  }

  // A value matches when it is in the positive set (`from`/`to`), or not in the
  // negative set (`not_from`/`not_to`); an absent or `null` constraint matches
  // anything. A `null` value (missing entity/attribute, HA's `None`) is itself a
  // real value: it matches only a constraint whose set contains `null`.
  private _matches(value: unknown, positive?: unknown, negative?: unknown): boolean {
    if (positive !== undefined && positive !== null) {
      return this._includes(positive, value);
    }
    if (negative !== undefined && negative !== null) {
      return !this._includes(negative, value);
    }
    return true;
  }

  protected _processEntityChange(
    entityID: string,
    oldStateObj: HassEntity | undefined,
    newStateObj: HassEntity | undefined,
  ): void {
    const trigger = this._trigger;
    const oldValue = this._readValue(oldStateObj);
    const newValue = this._readValue(newStateObj);

    // When watching an attribute, ignore changes that don't move it.
    if (trigger.attribute !== undefined && haEqual(oldValue, newValue)) {
      return;
    }

    const hasStateConstraint = this._hasStateConstraint();
    const matches =
      this._matches(oldValue, trigger.from, trigger.not_from) &&
      this._matches(newValue, trigger.to, trigger.not_to) &&
      // from/to test the values but not that they *differ*, so an attribute-only
      // event (value unchanged) can still satisfy them. Require a genuine change
      // when a constraint is set; with none, trigger on those too.
      !(hasStateConstraint && haEqual(oldValue, newValue));

    if (!matches) {
      // Only a real change of the watched value cancels a pending `for:` hold;
      // an attribute-only change (value unchanged) must leave it running, just
      // as HA's `for:` keys off the state, not the whole state object.
      if (!haEqual(oldValue, newValue)) {
        this._cancelForTimer(entityID);
      }
      return;
    }

    this._callTriggerOrHold(entityID, oldStateObj, newStateObj);
  }
}
