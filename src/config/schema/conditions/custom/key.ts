import { z } from 'zod';

export const keyConditionSchema = z.object({
  condition: z.literal('key'),
  key: z.string(),
  state: z.enum(['down', 'up']).optional(),
  ctrl: z.boolean().optional(),
  shift: z.boolean().optional(),
  alt: z.boolean().optional(),
  meta: z.boolean().optional(),
});
