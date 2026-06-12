import { z } from 'zod';

export const configBaseSchema = z.object({
  paths: z.string().array().optional(),
});
