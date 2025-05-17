import { z } from 'zod';
import { regexSchema } from '../../common/regex';

export const userAgentConditionSchema = z.object({
  condition: z.literal('user_agent'),
  user_agent: z.string().optional(),
  user_agent_re: regexSchema.optional(),
  companion: z.boolean().optional(),
});
