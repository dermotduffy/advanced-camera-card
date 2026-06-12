import { z } from 'zod';
import { fullscreenBaseSchema } from '../../common/fullscreen';

export const fullscreenConditionSchema = fullscreenBaseSchema.extend({
  condition: z.literal('fullscreen'),
});
