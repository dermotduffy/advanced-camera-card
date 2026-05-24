import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const substreamOnActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('substream_on'),

    // The camera that owns the substream. Defaults to the selected camera.
    camera: z.string().optional(),

    // The substream to engage: one of `camera`'s `substream` dependencies. When
    // omitted, repeated calls advance through `camera`'s `substream`
    // dependencies in order, wrapping back to no substream engaged.
    stream: z.string().optional(),
  });
export type SubstreamOnActionConfig = z.infer<typeof substreamOnActionConfigSchema>;
