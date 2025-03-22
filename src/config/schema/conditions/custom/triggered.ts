import { z } from 'zod';

export const triggeredConditionSchema = z.object({
  condition: z.literal('triggered'),
  triggered: z.string().array(),
});
