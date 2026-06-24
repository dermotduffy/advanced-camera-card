import { z } from 'zod';

import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const callAnswerActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('call_answer'),
  });
export type CallAnswerActionConfig = z.infer<typeof callAnswerActionConfigSchema>;
