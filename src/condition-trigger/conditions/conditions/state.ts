import { arrayify } from '../../../utils/basic';
import { renderTimePeriodToSeconds } from '../../common/time-period';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType, EvaluatorContext } from './types';

// Resolve each expected value that names an entity present in `hass` to that
// entity's current state, accepting either the literal or the resolved value
// (i.e. HA's Lovelace state condition will resolve "state: input_boolean.foo"
// to "state: on" when input_boolean.foo is on).
const resolveExpectedStates = (
  values: string | string[],
  state?: ConditionState,
): string[] =>
  arrayify(values).flatMap((value) => {
    const resolved = state?.hass?.states?.[value]?.state;
    return resolved !== undefined ? [value, resolved] : [value];
  });

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

      let result: boolean;
      if (!condition.state && !condition.state_not) {
        // With neither `state` nor `state_not`, match any change of value.
        result = toValue !== fromValue;
      } else if (toValue === null) {
        // A missing entity or attribute cannot match; an empty-string state is
        // a real value, handled in the comparison below.
        result = false;
      } else {
        result =
          (!condition.state ||
            resolveExpectedStates(condition.state, newState).includes(toValue)) &&
          (!condition.state_not ||
            !resolveExpectedStates(condition.state_not, newState).includes(toValue));
      }

      // `for`: the match must have been held for at least the given duration.
      // Evaluated against `last_changed` at evaluation time (correct for the
      // point-in-time / ongoing-condition use).
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

    return { result };
  }
}
