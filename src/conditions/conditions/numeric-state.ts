import { arrayify } from '../../utils/basic';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType, EvaluatorContext } from './types';

export class NumericStateConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'numeric_state'>;
  private _context: EvaluatorContext;

  constructor(condition: ConditionOfType<'numeric_state'>, context: EvaluatorContext) {
    this._condition = condition;
    this._context = context;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const condition = this._condition;

    // `entity` is canonical; `entity_id` is the accepted automation-dialect alias.
    // Either may be a list; with multiple entities all must match (HA's `match: all`).
    const entityIDs = arrayify(condition.entity ?? condition.entity_id);
    if (!entityIDs.length || !newState?.hass) {
      return { result: false };
    }
    const hass = newState.hass;

    // A threshold is a number, or an entity id whose state supplies it. An
    // unspecified threshold imposes no constraint; an unresolvable one fails.
    const checkBound = (
      value: number,
      compare: (value: number, bound: number) => boolean,
      threshold?: number | string,
    ): boolean => {
      if (threshold === undefined) {
        return true;
      }
      const bound =
        typeof threshold === 'number'
          ? threshold
          : Number(hass.states?.[threshold]?.state);
      return Number.isFinite(bound) && compare(value, bound);
    };

    const matchesEntity = (entityID: string): boolean => {
      const stateObj = hass.states?.[entityID];
      if (!stateObj) {
        return false;
      }

      // The compared value is the rendered template, else the attribute, else
      // the state.
      let rawValue: unknown;
      if (condition.value_template) {
        rawValue = this._context.templateRenderer.renderRecursively(
          hass,
          condition.value_template,
          { conditionState: newState },
        );
      } else if (condition.attribute) {
        rawValue = stateObj.attributes?.[condition.attribute];
      } else {
        rawValue = stateObj.state;
      }

      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        return false;
      }

      return (
        checkBound(value, (v, bound) => v > bound, condition.above) &&
        checkBound(value, (v, bound) => v < bound, condition.below)
      );
    };

    return { result: entityIDs.every(matchesEntity) };
  }
}
