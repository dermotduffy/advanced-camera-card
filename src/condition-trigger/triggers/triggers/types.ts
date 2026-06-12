import { TemplateRenderer } from '../../../card-controller/templates';
import { Trigger } from '../../../config/schema/condition-trigger/triggers/types';
import { ConditionStateManagerReadonlyInterface } from '../../conditions/types';
import { TriggerData } from '../types';

export type TriggerFireCallback = (data: TriggerData) => void;

export interface TriggerEvaluatorContext {
  stateManager: ConditionStateManagerReadonlyInterface;
  templateRenderer: TemplateRenderer;
}

export type TriggerOfType<T extends string> = Extract<Trigger, { trigger: T }>;

/**
 * A single trigger built from one `triggers:` entry: it watches its source and
 * fires `fireCallback` when its event occurs. The push-based sibling of the
 * pull-based `ConditionEvaluator`.
 */
export interface TriggerEvaluator {
  subscribe(fireCallback: TriggerFireCallback): void;
  destroy(): void;
}
