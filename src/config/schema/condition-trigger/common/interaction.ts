import { z } from 'zod';

export const interactionBaseSchema = z.object({
  interaction: z.boolean().optional(),
});
export type InteractionBase = z.infer<typeof interactionBaseSchema>;
