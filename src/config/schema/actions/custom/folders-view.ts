import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const foldersViewActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('folders').or(z.literal('folder')),
    folder: z.string().optional(),
  });
export type FoldersViewActionConfig = z.infer<typeof foldersViewActionConfigSchema>;
