import type { TemplateRenderer } from '../../../card-controller/templates';
import type { Condition } from '../../../config/schema/condition-trigger/conditions/types';
import type { ConditionsEvaluationResult, ConditionState } from '../types';

export type ExternalInvalidationUnsubscribeCallback = () => void;

// A source of change outside the card's `ConditionState` that can invalidate a
// condition's result (currently only `screen`, via `matchMedia`). A condition
// declares its sources so a reactive consumer knows what to watch; a pull
// consumer ignores them.
export interface ExternalInvalidationSource {
  subscribe(callback: () => void): ExternalInvalidationUnsubscribeCallback;
}

/**
 * A single condition, constructed once with its configuration and evaluated
 * repeatedly against incoming state.
 */
export interface ConditionEvaluator {
  evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult;

  // Sources of change outside `ConditionState` that can invalidate this
  // condition's result (currently only `screen`, via `matchMedia`). A reactive
  // consumer subscribes to them to know when to re-evaluate; a pull consumer
  // ignores them.
  externalSources?: ExternalInvalidationSource[];
}

export interface EvaluatorContext {
  templateRenderer: TemplateRenderer;
}

// The condition union member(s) carrying a given discriminator literal.
export type ConditionOfType<T extends string> = Extract<Condition, { condition?: T }>;
