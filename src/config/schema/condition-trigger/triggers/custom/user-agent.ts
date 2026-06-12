import { z } from 'zod';
import { userAgentBaseSchema } from '../../common/user-agent';
import { triggerBaseSchema } from '../base';

export const userAgentTriggerSchema = userAgentBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('user_agent') });
