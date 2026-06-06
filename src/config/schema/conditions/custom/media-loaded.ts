import { z } from 'zod';
import { mediaLoadedBaseSchema } from '../../common/condition-trigger/media-loaded';

export const mediaLoadedConditionSchema = mediaLoadedBaseSchema.extend({
  condition: z.literal('media_loaded'),
});
