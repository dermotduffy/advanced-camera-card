import { z } from 'zod';

export const callConditionSchema = z.object({
  condition: z.literal('call'),
  call: z.boolean().optional(),
});
