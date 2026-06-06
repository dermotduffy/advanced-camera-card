import { z } from 'zod';
import { timePeriodSchema } from '../../common/time-period';
import { triggerBaseSchema } from '../base';

// https://www.home-assistant.io/docs/automation/trigger/#template-trigger
export const templateTriggerSchema = triggerBaseSchema.extend({
  trigger: z.literal('template'),
  value_template: z.string(),
  for: timePeriodSchema.optional(),
});
