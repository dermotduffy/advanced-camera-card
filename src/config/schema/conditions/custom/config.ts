import { z } from 'zod';

export const configConditionSchema = z.object({
  condition: z.literal('config'),
  paths: z.string().array().optional(),
});
