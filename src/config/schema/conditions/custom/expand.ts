import { z } from 'zod';

export const expandConditionSchema = z.object({
  condition: z.literal('expand'),
  expand: z.boolean(),
});
