import { z } from 'zod';

import { regexSchema } from '../../common/regex';

export const userAgentBaseSchema = z.object({
  user_agent: z.string().optional(),
  user_agent_re: regexSchema.optional(),
  casting: z.boolean().optional(),
  companion: z.boolean().optional(),
});
