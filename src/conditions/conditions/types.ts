import { TemplateRenderer } from '../../card-controller/templates';
import { AdvancedCameraCardCondition } from '../../config/schema/conditions/types';
import { ConditionsEvaluationResult, ConditionState } from '../types';

export type ConditionEvaluatorSubscriptionCallback = () => void;

/**
 * A single condition, constructed once with its configuration and evaluated
 * repeatedly against incoming state.
 */
export interface ConditionEvaluator {
  evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult;

  // Optional hook for conditions with an external change source (e.g.
  // `screen`). The owner passes a callback to request re-evaluation.
  subscribe?(onChange: ConditionEvaluatorSubscriptionCallback): void;

  destroy?(): void;
}

export interface EvaluatorContext {
  templateRenderer: TemplateRenderer;
}

// The condition union member(s) carrying a given discriminator literal.
export type ConditionOfType<T extends string> = Extract<
  AdvancedCameraCardCondition,
  { condition?: T }
>;
