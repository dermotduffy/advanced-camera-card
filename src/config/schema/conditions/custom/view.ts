import { z } from 'zod';
import { viewBaseSchema } from '../../common/condition-trigger/view';

export const viewConditionSchema = viewBaseSchema.extend({
  condition: z.literal('view'),
});
