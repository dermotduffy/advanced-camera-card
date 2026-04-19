import { z } from 'zod';

export const callEndedConditionSchema = z.object({
  condition: z.literal('call_ended'),
});
