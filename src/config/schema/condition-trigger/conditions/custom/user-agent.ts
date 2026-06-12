import { z } from 'zod';
import { userAgentBaseSchema } from '../../common/user-agent';

export const userAgentConditionSchema = userAgentBaseSchema.extend({
  condition: z.literal('user_agent'),
});
