import { z } from 'zod';
import { mediaLoadedBaseSchema } from '../../common/media-loaded';

export const mediaLoadedConditionSchema = mediaLoadedBaseSchema.extend({
  condition: z.literal('media_loaded'),
});
