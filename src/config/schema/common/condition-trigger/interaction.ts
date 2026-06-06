import { z } from 'zod';

export const interactionBaseSchema = z.object({
  interaction: z.boolean(),
});
