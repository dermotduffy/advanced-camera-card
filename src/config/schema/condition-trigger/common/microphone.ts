import { z } from 'zod';

export const microphoneBaseSchema = z.object({
  connected: z.boolean().optional(),
  muted: z.boolean().optional(),
});
export type MicrophoneBase = z.infer<typeof microphoneBaseSchema>;
