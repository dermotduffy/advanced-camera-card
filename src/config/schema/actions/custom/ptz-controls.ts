import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const ptzControlsActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('ptz_controls'),
    enabled: z.boolean(),
  });
export type PTZControlsActionConfig = z.infer<typeof ptzControlsActionConfigSchema>;
