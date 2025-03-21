import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

const LOG_ACTIONS_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogActionLevel = (typeof LOG_ACTIONS_LEVELS)[number];

export const logActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('log'),
  message: z.string(),
  level: z.enum(LOG_ACTIONS_LEVELS).default('info'),
});
export type LogActionConfig = z.infer<typeof logActionConfigSchema>;
