import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const callEndActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('call_end'),
  });
export type CallEndActionConfig = z.infer<typeof callEndActionConfigSchema>;
