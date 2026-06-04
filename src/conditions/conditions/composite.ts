import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionEvaluatorSubscriptionCallback } from './types';

/**
 * Base class for the `or`/`and`/`not` composites: each holds child evaluators
 * and forwards subscription/teardown to them. Subclasses provide `evaluate`.
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

  public subscribe(onChange: ConditionEvaluatorSubscriptionCallback): void {
    this._children.forEach((child) => child.subscribe?.(onChange));
  }

  public destroy(): void {
    this._children.forEach((child) => child.destroy?.());
  }
}
