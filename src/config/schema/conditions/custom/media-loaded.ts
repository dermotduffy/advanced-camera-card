import { z } from 'zod';

export const mediaLoadedConditionSchema = z.object({
  condition: z.literal('media_loaded'),
  media_loaded: z.boolean(),
});
