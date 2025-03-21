import { z } from 'zod';

export const fullscreenConditionSchema = z.object({
  condition: z.literal('fullscreen'),
  fullscreen: z.boolean(),
});
