import { z } from 'zod';

export const mediaLoadedBaseSchema = z.object({
  media_loaded: z.boolean(),
});
