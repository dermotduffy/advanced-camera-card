import { Trigger } from '../../config/schema/condition-trigger/triggers/types';
import { CameraTrigger } from './triggers/camera';
import { ConditionRisingEdgeTrigger } from './triggers/condition-rising-edge';
import { ConfigTrigger } from './triggers/config';
import { NumericStateTrigger } from './triggers/numeric-state';
import { StateTrigger } from './triggers/state';
import { TemplateTrigger } from './triggers/template';
import { TriggerEvaluator, TriggerEvaluatorContext } from './triggers/types';
import { ViewTrigger } from './triggers/view';

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

    // `camera`/`view`/`config` watch a single card-state facet and own a
    // "trigger on any change" form, so they have dedicated classes (like the
    // stock triggers).
    case 'camera':
      return new CameraTrigger(trigger, context);
    case 'view':
      return new ViewTrigger(trigger, context);
    case 'config':
      return new ConfigTrigger(trigger, context);

    // Every other card-specific trigger (`display_mode`/.../`screen`) triggers
    // on the rising edge of its (re-used) condition.
    default:
      return new ConditionRisingEdgeTrigger(trigger, context);
  }
};
