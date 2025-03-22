import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const substreamSelectActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('live_substream_select'),
    camera: z.string(),
  });
export type SubstreamSelectActionConfig = z.infer<
  typeof substreamSelectActionConfigSchema
>;
