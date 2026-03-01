import { z } from 'zod';
import { PTZ_CONTROL_TYPES } from '../../common/controls/ptz';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const ptzControlsActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('ptz_controls'),
    enabled: z.boolean().optional(),
    type: z.enum(PTZ_CONTROL_TYPES).optional(),
  });
export type PTZControlsActionConfig = z.infer<typeof ptzControlsActionConfigSchema>;
