import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

const timeDeltaSchema = z.object({
  ms: z.number().optional(),
  s: z.number().optional(),
  m: z.number().optional(),
  h: z.number().optional(),
});
export type TimeDelta = z.infer<typeof timeDeltaSchema>;

export const sleepActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('sleep'),
  duration: timeDeltaSchema.optional().default({ s: 1 }),
});
export type SleepActionConfig = z.infer<typeof sleepActionConfigSchema>;
