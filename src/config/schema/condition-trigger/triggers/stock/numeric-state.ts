import { z } from 'zod';

import { timePeriodSchema } from '../../../common/time-period';
import {
  aboveNotGreaterThanBelow,
  hasAboveOrBelow,
  numericStateBaseSchema,
} from '../../common/numeric-state';
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
  )
  .refine(
    aboveNotGreaterThanBelow,
    'A numeric_state trigger cannot have `above` greater than `below`',
  );
