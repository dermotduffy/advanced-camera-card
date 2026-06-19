import { z } from 'zod';
import { fullscreenBaseSchema } from '../../common/fullscreen';
import { conditionBaseSchema } from '../base';

export const fullscreenConditionSchema = fullscreenBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('fullscreen'),
    fullscreen: z.boolean(),
  });
