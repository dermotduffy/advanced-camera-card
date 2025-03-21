import { z } from 'zod';

export const debugConfigDefault = {
  logging: false,
};

export const debugConfigSchema = z
  .object({
    logging: z.boolean().default(debugConfigDefault.logging),
  })
  .default(debugConfigDefault);
export type DebugConfig = z.infer<typeof debugConfigSchema>;
