import { z } from 'zod';
import { VIEWS_USER_SPECIFIED } from '../../common/const';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const viewActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.enum(VIEWS_USER_SPECIFIED),
});
export type ViewActionConfig = z.infer<typeof viewActionConfigSchema>;
