import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';
import { PTZ_ACTION_PHASES, PTZ_ACTIONS } from './ptz';

export const ptzMultiActionSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('ptz_multi'),
  target_id: z.string().optional(),

  ptz_action: z.enum(PTZ_ACTIONS).optional(),
  ptz_phase: z.enum(PTZ_ACTION_PHASES).optional(),
  ptz_preset: z.string().optional(),
});
export type PTZMultiActionConfig = z.infer<typeof ptzMultiActionSchema>;
