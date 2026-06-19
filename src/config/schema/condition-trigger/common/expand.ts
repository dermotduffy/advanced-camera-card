import { z } from 'zod';

export const expandBaseSchema = z.object({
  expand: z.boolean().optional(),
});
export type ExpandBase = z.infer<typeof expandBaseSchema>;
