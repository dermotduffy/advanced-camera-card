import { z } from 'zod';
import { hasAboveOrBelow, numericStateBaseSchema } from '../../common/numeric-state';
import { timePeriodSchema } from '../../../common/time-period';
import { triggerBaseSchema } from '../base';
import { entityTriggerBaseSchema } from './entity-base';

// https://www.home-assistant.io/docs/automation/trigger/#numeric-state-trigger
export const numericStateTriggerSchema = entityTriggerBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend(numericStateBaseSchema.shape)
  .extend({
    trigger: z.literal('numeric_state'),
    for: timePeriodSchema.optional(),
  })
  .refine(
    hasAboveOrBelow,
    'A numeric_state trigger requires at least one of `above`/`below`',
  );
