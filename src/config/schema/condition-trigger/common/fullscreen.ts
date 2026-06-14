import { z } from 'zod';

export const fullscreenBaseSchema = z.object({
  fullscreen: z.boolean().default(true),
});
