import { z } from 'zod';

export const cameraConditionSchema = z.object({
  condition: z.literal('camera'),
  cameras: z.string().array().optional(),
});
