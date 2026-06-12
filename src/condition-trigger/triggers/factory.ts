import { Trigger } from '../../config/schema/condition-trigger/triggers/types';
import { ACCTrigger } from './triggers/acc';
import { NumericStateTrigger } from './triggers/numeric-state';
import { StateTrigger } from './triggers/state';
import { TemplateTrigger } from './triggers/template';
import { TriggerEvaluator, TriggerEvaluatorContext } from './triggers/types';

export const createTriggerEvaluator = (
  trigger: Trigger,
  context: TriggerEvaluatorContext,
): TriggerEvaluator => {
  switch (trigger.trigger) {
    case 'state':
      return new StateTrigger(trigger, context);
    case 'numeric_state':
      return new NumericStateTrigger(trigger, context);
    case 'template':
      return new TemplateTrigger(trigger, context);

    // Every card-specific trigger (`camera`/`view`/`config`/.../`screen`/`user`)
    // shares the single ACCTrigger path.
    default:
      return new ACCTrigger(trigger, context);
  }
};
