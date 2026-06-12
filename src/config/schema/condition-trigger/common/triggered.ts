import { z } from 'zod';

export const triggeredBaseSchema = z.object({
  triggered: z.string().array(),
});
