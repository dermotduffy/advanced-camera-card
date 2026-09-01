import { haEqual } from '../../../ha/event-match';
import { arrayify, arrayifyWithFalsy } from '../../../utils/basic';
import { renderTimePeriodToSeconds } from '../../common/time-period';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator, ConditionOfType, EvaluatorContext } from './types';

// Home Assistant resolves an expected value that names an `input_*` helper to
// that helper's current state (its Lovelace state-condition behavior), on both
// the state and the attribute path; only these helper domains are resolved.
// Regexp directly from:
// https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/condition.py
const INPUT_ENTITY_ID =
  /^input_(?:select|text|number|boolean|datetime)\.(?!.+__)[\da-z](?:[\da-z_]*[\da-z])?$/;

const isInputHelperName = (value: unknown): value is string =>
  typeof value === 'string' && INPUT_ENTITY_ID.test(value);

// Resolve an expected value: an `input_*` helper name becomes that helper's
// state (compared in its place, not the literal name); any other value is used
// as-is. A referenced helper is guaranteed present here -- missing ones stop the
// scan in `matchesExpected` before this is called.
const resolveExpectedValue = (expected: unknown, state?: ConditionState): unknown =>
  isInputHelperName(expected) ? state?.hass?.states?.[expected]?.state : expected;

export class StateConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'state'>;
  private _context: EvaluatorContext;

  constructor(condition: ConditionOfType<'state'>, context: EvaluatorContext) {
    this._condition = condition;
    this._context = context;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    const condition = this._condition;
    const attribute = condition.attribute;

    // `entity` is canonical; `entity_id` is the accepted automation-dialect alias.
    // Either may be a list; with multiple entities all must match (HA's `match: all`).
    const entityIDs = arrayify(condition.entity ?? condition.entity_id);
    if (!entityIDs.length) {
      return { result: false };
    }

    // The state (a string) or, when `attribute` is set, the raw attribute value
    // (any type, including a present `null`). Returns `undefined` when the
    // entity is missing or the attribute key is absent, which HA treats as no
    // match -- distinct from a present `null` value (`0`/`false`/`''` are also
    // real). HA attributes arrive as JSON, so a present value is never
    // `undefined`.
    const readValue = (entityID: string, state?: ConditionState): unknown => {
      const stateObj = state?.hass?.states?.[entityID];
      if (!stateObj) {
        return undefined;
      }
      if (attribute !== undefined) {
        // Own-property check (not `in`) so inherited props like `toString` are
        // not mistaken for attributes, matching Python dict membership.
        return Object.prototype.hasOwnProperty.call(stateObj.attributes, attribute)
          ? stateObj.attributes[attribute]
          : undefined;
      }
      return stateObj.state;
    };

    // Whether `value` matches one of the configured expected values, scanned in
    // order with HA's Python `==` semantics (so `50` equals `50`, `true` equals
    // `1`, and `50` does not equal `"50"`). An `input_*` helper name is matched
    // by its state; HA stops and fails at a referenced helper that is
    // unavailable, so the scan stops there rather than trying later values.
    const matchesExpected = (expected: unknown, value: unknown): boolean => {
      for (const v of arrayifyWithFalsy(expected)) {
        if (isInputHelperName(v) && !newState?.hass?.states?.[v]) {
          return false;
        }
        if (haEqual(value, resolveExpectedValue(v, newState))) {
          return true;
        }
      }
      return false;
    };

    const matchesEntity = (entityID: string): boolean => {
      const fromValue = readValue(entityID, oldState);
      const toValue = readValue(entityID, newState);

      let result: boolean;
      if (condition.state === undefined && condition.state_not === undefined) {
        // With neither `state` nor `state_not`, match any change of value.
        result = !haEqual(toValue, fromValue);
      } else if (toValue === undefined) {
        // A missing entity or attribute cannot match. A present value (including
        // `null` or `''`) is a real value, handled in the comparison below.
        result = false;
      } else {
        result =
          (condition.state === undefined || matchesExpected(condition.state, toValue)) &&
          (condition.state_not === undefined ||
            !matchesExpected(condition.state_not, toValue));
      }

      // `for`: the match must have been held for longer than the given duration.
      // Evaluated against `last_changed` at evaluation time (correct for the
      // point-in-time / ongoing-condition use). HA compares strictly (`>`).
      if (result && condition.for !== undefined) {
        const forSeconds = renderTimePeriodToSeconds(
          this._context.templateRenderer,
          condition.for,
          newState,
        );
        const lastChanged = newState?.hass?.states?.[entityID]?.last_changed;
        if (forSeconds === null || !lastChanged) {
          result = false;
        } else {
          const heldSeconds =
            (new Date().getTime() - new Date(lastChanged).getTime()) / 1000;
          result = heldSeconds > forSeconds;
        }
      }
      return result;
    };

    // `match: any` requires one entity to match; `all` (the default) requires all.
    const result =
      condition.match === 'any'
        ? entityIDs.some(matchesEntity)
        : entityIDs.every(matchesEntity);

    return { result };
  }
}
