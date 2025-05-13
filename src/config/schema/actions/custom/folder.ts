import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const folderActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend(
  {
    advanced_camera_card_action: z.literal('folder'),
    folder: z.string().optional(),
  },
);
export type FolderActionConfig = z.infer<typeof folderActionConfigSchema>;
