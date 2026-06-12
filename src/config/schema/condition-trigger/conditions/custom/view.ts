import { z } from 'zod';
import { viewBaseSchema } from '../../common/view';

export const viewConditionSchema = viewBaseSchema.extend({
  condition: z.literal('view'),
});
