import { z } from 'zod';
import { fullscreenBaseSchema } from '../../common/condition-trigger/fullscreen';

export const fullscreenConditionSchema = fullscreenBaseSchema.extend({
  condition: z.literal('fullscreen'),
});
