import type { ReadonlyDeep } from 'type-fest';

import { arrayify } from '../../../utils/basic';
import { matchesNumericState } from '../../common/numeric-state';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator, ConditionOfType, EvaluatorContext } from './types';

export class NumericStateConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<ConditionOfType<'numeric_state'>>;
  private _context: EvaluatorContext;

  constructor(
    condition: ReadonlyDeep<ConditionOfType<'numeric_state'>>,
    context: EvaluatorContext,
  ) {
    this._condition = condition;
    this._context = context;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    const condition = this._condition;

    // `entity` is canonical; `entity_id` is the accepted automation-dialect alias.
    // Either may be a list; with multiple entities all must match (HA's `match: all`).
    const entityIDs = arrayify(condition.entity ?? condition.entity_id);
    if (!entityIDs.length || !newState) {
      return { result: false };
    }

    return {
      result: entityIDs.every((entityID) =>
        matchesNumericState(
          entityID,
          newState,
          condition,
          this._context.templateRenderer,
        ),
      ),
    };
  }
}
