import { z } from 'zod';

export const viewConditionSchema = z.object({
  condition: z.literal('view'),
  views: z.string().array().optional(),
});
