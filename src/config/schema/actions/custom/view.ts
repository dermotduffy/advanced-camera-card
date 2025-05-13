import { z } from 'zod';
import {
  AdvancedCameraCardUserSpecifiedView,
  VIEWS_USER_SPECIFIED,
} from '../../common/const';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

type AdvancedCameraCardUserSpecifiedViewWithoutFolder = Exclude<
  AdvancedCameraCardUserSpecifiedView,
  'folder'
>;

export const viewActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.enum(
    // The folder view is handled by the `folder` action since it accepts an
    // optional folder ID.
    VIEWS_USER_SPECIFIED.filter((view) => view !== 'folder') as [
      AdvancedCameraCardUserSpecifiedViewWithoutFolder,
      ...AdvancedCameraCardUserSpecifiedViewWithoutFolder[],
    ],
  ),
});
export type ViewActionConfig = z.infer<typeof viewActionConfigSchema>;
