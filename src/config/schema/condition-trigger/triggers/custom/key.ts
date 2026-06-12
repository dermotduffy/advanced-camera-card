import { z } from 'zod';
import { keyBaseSchema } from '../../common/key';
import { triggerBaseSchema } from '../base';

export const keyTriggerSchema = keyBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('key') });
