import { z } from 'zod';
import { panSchema } from '../../common/pan';
import { zoomSchema } from '../../common/zoom';
import { advancedCameraCardCustomActionsBaseSchema } from './base';
import { PTZ_ACTION_PHASES, PTZ_ACTIONS } from './ptz';

export const ptzDigitalActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('ptz_digital'),
    target_id: z.string().optional(),
    absolute: z
      .object({
        zoom: zoomSchema.optional(),
        pan: panSchema.optional(),
      })
      .optional(),
    ptz_action: z.enum(PTZ_ACTIONS).optional(),
    ptz_phase: z.enum(PTZ_ACTION_PHASES).optional(),
  });
export type PTZDigitialActionConfig = z.infer<typeof ptzDigitalActionConfigSchema>;
