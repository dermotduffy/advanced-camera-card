import { z } from 'zod';
import { mediaLoadedBaseSchema } from '../../common/media-loaded';
import { conditionBaseSchema } from '../base';

export const mediaLoadedConditionSchema = mediaLoadedBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('media_loaded'),
  });
