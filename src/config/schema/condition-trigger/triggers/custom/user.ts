import { z } from 'zod';
import { userBaseSchema } from '../../common/user';
import { triggerBaseSchema } from '../base';

export const userTriggerSchema = userBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('user') });
