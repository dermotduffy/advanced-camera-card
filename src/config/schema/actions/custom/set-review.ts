import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

export const setReviewActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('set_review'),

    // Mark a review as reviewed or unreviewed.
    // - true = mark reviewed
    // - false = mark unreviewed
    // - undefined = toggle reviewed status
    reviewed: z.boolean().optional(),
  });
export type SetReviewActionConfig = z.infer<typeof setReviewActionConfigSchema>;
