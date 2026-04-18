import { z } from 'zod';

export const callStartedConditionSchema = z.object({
  condition: z.literal('call_started'),
});