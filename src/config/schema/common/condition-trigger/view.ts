import { z } from 'zod';

export const viewBaseSchema = z.object({
  views: z.string().array().optional(),
});
