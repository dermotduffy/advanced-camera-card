import { z } from 'zod';

export const callBaseSchema = z.object({
  call: z.boolean().optional(),
});
export type CallBase = z.infer<typeof callBaseSchema>;
