import { z } from 'zod';

export const keyBaseSchema = z.object({
  key: z.string().optional(),
  state: z.enum(['down', 'up']).optional(),
  ctrl: z.boolean().optional(),
  shift: z.boolean().optional(),
  alt: z.boolean().optional(),
  meta: z.boolean().optional(),
});
export type KeyBase = z.infer<typeof keyBaseSchema>;
