import type { HASSManagerReadonlyInterface } from '../../../card-controller/hass/types';
import type { TemplateRenderer } from '../../../card-controller/templates';
import type { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import type { ConditionStateManagerReadonlyInterface } from '../../conditions/types';
import type { TriggerData } from '../types';

export type TriggerCallback = (data: TriggerData) => void;

export interface TriggerEvaluatorContext {
  stateManager: ConditionStateManagerReadonlyInterface;
  templateRenderer: TemplateRenderer;
  hassManager: HASSManagerReadonlyInterface;
}

export type TriggerOfType<T extends string> = Extract<Trigger, { trigger: T }>;

/**
 * A single trigger built from one `triggers:` entry: it watches its source and
 * invokes `callback` when its event occurs. The push-based sibling of the
 * pull-based `ConditionEvaluator`.
 */
export interface TriggerEvaluator {
  subscribe(callback: TriggerCallback): void;
  destroy(): void;
}
