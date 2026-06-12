import { z } from 'zod';

export const cameraBaseSchema = z.object({
  cameras: z.string().array().optional(),
});
