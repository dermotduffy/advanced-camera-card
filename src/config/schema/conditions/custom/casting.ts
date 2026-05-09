import { z } from 'zod';

export const castingConditionSchema = z.object({
  condition: z.literal('casting'),
  casting: z.boolean(),
});
