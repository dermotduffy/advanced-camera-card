import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator, ExternalInvalidationSource } from './types';

/**
 * Base class for the `or`/`and`/`not` composites: each holds child evaluators
 * and unions their external invalidation sources. Subclasses provide
 * `evaluate`.
 */
export abstract class CompositeConditionEvaluator implements ConditionEvaluator {
  protected _children: ConditionEvaluator[];

  constructor(children: ConditionEvaluator[]) {
    this._children = children;
  }

  public abstract evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult;

  public get externalSources(): ExternalInvalidationSource[] {
    return this._children.flatMap((child) => child.externalSources ?? []);
  }
}
