import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const callStartActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('call_start'),

    // The camera to start the call on. Defaults to the selected camera.
    camera: z.string().optional(),

    // The 2-way-audio stream to carry the call: Could be `camera` itself, or
    // one of its 2-way-audio dependencies. Defaults to the first eligible.
    stream: z.string().optional(),
  });
export type CallStartActionConfig = z.infer<typeof callStartActionConfigSchema>;
