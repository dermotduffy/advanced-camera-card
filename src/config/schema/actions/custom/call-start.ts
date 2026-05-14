import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const callStartActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('call_start'),

    // Which camera to call. Defaults to the selected camera (if it has 2-way
    // audio) or the first 2-way-audio-capable dependency.
    camera: z.string().optional(),
  });
export type CallStartActionConfig = z.infer<typeof callStartActionConfigSchema>;
