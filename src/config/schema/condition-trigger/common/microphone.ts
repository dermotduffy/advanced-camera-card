import { z } from 'zod';

export const microphoneBaseSchema = z.object({
  muted: z.boolean().optional(),
});
export type MicrophoneBase = z.infer<typeof microphoneBaseSchema>;
