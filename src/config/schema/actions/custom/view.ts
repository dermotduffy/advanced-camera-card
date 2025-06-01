import { z } from 'zod';
import {
  AdvancedCameraCardUserSpecifiedView,
  VIEWS_USER_SPECIFIED,
} from '../../common/const';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

type AdvancedCameraCardUserSpecifiedViewWithoutFolder = Exclude<
  AdvancedCameraCardUserSpecifiedView,
  'folder' | 'folders'
>;

export const viewActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.enum(
    // The folder/folders views are handled separately as they accept an
    // optional folder ID.
    VIEWS_USER_SPECIFIED.filter((view) => view !== 'folder' && view !== 'folders') as [
      AdvancedCameraCardUserSpecifiedViewWithoutFolder,
      ...AdvancedCameraCardUserSpecifiedViewWithoutFolder[],
    ],
  ),
});
export type ViewActionConfig = z.infer<typeof viewActionConfigSchema>;
