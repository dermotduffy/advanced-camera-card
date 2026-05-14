import { z } from 'zod';

export const microphoneConditionSchema = z.object({
  condition: z.literal('microphone'),
  muted: z.boolean(),
});
