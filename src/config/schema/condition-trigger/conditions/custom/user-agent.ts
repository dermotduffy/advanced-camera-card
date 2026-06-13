import { z } from 'zod';
import { userAgentBaseSchema } from '../../common/user-agent';
import { conditionBaseSchema } from '../base';

export const userAgentConditionSchema = userAgentBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('user_agent'),
  });
