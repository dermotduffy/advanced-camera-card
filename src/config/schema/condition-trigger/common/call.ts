import { z } from 'zod';

export const callBaseSchema = z.object({
  call: z.boolean().default(true),
});
