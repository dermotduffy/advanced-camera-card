import { getEarliestDate } from '../../../utils/date/compare';
import type { ConditionState } from '../types';
import type {
  ConditionEvaluator,
  ConditionEvaluatorResult,
  ExternalInvalidationSource,
} from './types';

/**
 * Base class for the `or`/`and`/`not` composites: each holds child evaluators,
 * evaluates them in order until one determines the result, and unions their
 * external invalidation sources. Subclasses declare the determinant.
 */
export abstract class CompositeConditionEvaluator implements ConditionEvaluator {
  protected _children: ConditionEvaluator[];

  // Children are evaluated in order. The first child to return `childResult`
  // stops the evaluation, and the composite returns `compositeResult`; when no
  // child returns `childResult`, the composite returns `!compositeResult`. For
  // example, `and` uses `{ childResult: false, compositeResult: false }`: the
  // first failing child makes it fail, and when none fails it passes.
  protected abstract readonly _determinant: {
    childResult: boolean;
    compositeResult: boolean;
  };

  constructor(children: ConditionEvaluator[]) {
    this._children = children;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionEvaluatorResult {
    let result = !this._determinant.compositeResult;

    // Children after the determining one cannot change the result until the
    // determining one does, so only the evaluated children's times count.
    let validUntil: Date | null = null;

    for (const child of this._children) {
      const evaluation = child.evaluate(newState, oldState);
      validUntil = getEarliestDate(validUntil, evaluation.validUntil);
      if (evaluation.result === this._determinant.childResult) {
        result = this._determinant.compositeResult;
        break;
      }
    }
    return validUntil ? { result, validUntil } : { result };
  }

  public get externalSources(): ExternalInvalidationSource[] {
    return this._children.flatMap((child) => child.externalSources ?? []);
  }
}
