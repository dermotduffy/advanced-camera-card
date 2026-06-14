import { z } from 'zod';

export const expandBaseSchema = z.object({
  expand: z.boolean().default(true),
});
