import { z } from 'zod';
import { viewBaseSchema } from '../../common/view';
import { triggerBaseSchema } from '../base';

export const viewTriggerSchema = viewBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('view') });
