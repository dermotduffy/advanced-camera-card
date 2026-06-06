import { z } from 'zod';
import { screenBaseSchema } from '../../common/condition-trigger/screen';
import { triggerBaseSchema } from '../base';

export const screenTriggerSchema = screenBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('screen') });
