import { parseTimePeriodToSeconds } from '../../../ha/parse-time-period';
import { arrayify } from '../../../utils/basic';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class StateConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'state'>;

  constructor(condition: ConditionOfType<'state'>) {
    this._condition = condition;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    const condition = this._condition;

    // `entity` is canonical; `entity_id` is the accepted automation-dialect alias.
    // Either may be a list; with multiple entities all must match (HA's `match: all`).
    const entityIDs = arrayify(condition.entity ?? condition.entity_id);
    if (!entityIDs.length) {
      return { result: false };
    }

    // The compared value is the attribute when `attribute` is set, else the state.
    const readValue = (entityID: string, state?: ConditionState): string | null => {
      const stateObj = state?.hass?.states?.[entityID];
      if (!stateObj) {
        return null;
      }
      if (condition.attribute) {
        const value = stateObj.attributes?.[condition.attribute];
        return value === undefined || value === null ? null : String(value);
      }
      return stateObj.state;
    };

    const matchesEntity = (entityID: string): boolean => {
      const fromValue = readValue(entityID, oldState);
      const toValue = readValue(entityID, newState);

      let result =
        (!condition.state && !condition.state_not && toValue !== fromValue) ||
        ((!!condition.state || !!condition.state_not) &&
          !!toValue &&
          (!condition.state ||
            (Array.isArray(condition.state)
              ? condition.state.includes(toValue)
              : condition.state === toValue)) &&
          (!condition.state_not ||
            (Array.isArray(condition.state_not)
              ? !condition.state_not.includes(toValue)
              : condition.state_not !== toValue)));

      // `for`: the match must have been held for at least the given duration.
      // Evaluated against `last_changed` at evaluation time (correct for the
      // point-in-time / ongoing-condition use).
      if (result && condition.for !== undefined) {
        const forSeconds = parseTimePeriodToSeconds(condition.for);
        const lastChanged = newState?.hass?.states?.[entityID]?.last_changed;
        if (forSeconds === null || !lastChanged) {
          result = false;
        } else {
          const heldSeconds =
            (new Date().getTime() - new Date(lastChanged).getTime()) / 1000;
          result = heldSeconds >= forSeconds;
        }
      }
      return result;
    };

    // `match: any` requires one entity to match; `all` (the default) requires all.
    const result =
      condition.match === 'any'
        ? entityIDs.some(matchesEntity)
        : entityIDs.every(matchesEntity);

    // A change edge is reported when any watched entity's value transitions.
    const changed = entityIDs.some(
      (entityID) => readValue(entityID, oldState) !== readValue(entityID, newState),
    );

    return { result, changed };
  }
}
