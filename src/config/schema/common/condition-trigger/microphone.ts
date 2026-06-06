import { z } from 'zod';

export const microphoneBaseSchema = z.object({
  muted: z.boolean(),
});
