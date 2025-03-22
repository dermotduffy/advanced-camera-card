import { z } from 'zod';

export const interactionConditionSchema = z.object({
  condition: z.literal('interaction'),
  interaction: z.boolean(),
});
