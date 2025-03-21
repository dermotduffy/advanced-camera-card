import { z } from 'zod';

export const remoteControlConfigSchema = z
  .object({
    entities: z
      .object({
        camera: z.string().startsWith('input_select.').optional(),
      })
      .optional(),
  })
  .optional();
