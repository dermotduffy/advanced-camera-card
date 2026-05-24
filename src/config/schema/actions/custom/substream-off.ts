import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const substreamOffActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('substream_off'),

    // The camera whose substream override to clear. Defaults to the selected
    // camera. A no-op if that camera has no substream engaged.
    camera: z.string().optional(),
  });
export type SubstreamOffActionConfig = z.infer<typeof substreamOffActionConfigSchema>;
