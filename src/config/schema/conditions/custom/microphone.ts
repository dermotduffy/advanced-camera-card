import { z } from 'zod';

export const microphoneConditionSchema = z.object({
  condition: z.literal('microphone'),
  connected: z.boolean().optional(),
  muted: z.boolean().optional(),
});
