import { z } from 'zod';

export const fullscreenBaseSchema = z.object({
  fullscreen: z.boolean().optional(),
});
export type FullscreenBase = z.infer<typeof fullscreenBaseSchema>;
