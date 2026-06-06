import { z } from 'zod';

export const keyBaseSchema = z.object({
  key: z.string(),
  state: z.enum(['down', 'up']).optional(),
  ctrl: z.boolean().optional(),
  shift: z.boolean().optional(),
  alt: z.boolean().optional(),
  meta: z.boolean().optional(),
});
