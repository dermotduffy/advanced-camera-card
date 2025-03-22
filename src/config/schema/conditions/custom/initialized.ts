import { z } from 'zod';

export const initializedConditionSchema = z.object({
  condition: z.literal('initialized'),
});
