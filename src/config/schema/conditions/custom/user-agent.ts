import { z } from 'zod';

export const userAgentConditionSchema = z.object({
  condition: z.literal('user_agent'),
  user_agent: z.string().optional(),
  user_agent_re: z
    .string()
    .refine(
      (val) => {
        try {
          new RegExp(val);
        } catch {
          return false;
        }
        return true;
      },
      { message: 'Invalid regular expression' },
    )
    .optional(),
  companion: z.boolean().optional(),
});
