import { z } from 'zod';

export const viewBaseSchema = z.object({
  views: z.string().array().optional(),
});
export type ViewBase = z.infer<typeof viewBaseSchema>;
