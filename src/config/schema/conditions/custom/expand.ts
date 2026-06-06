import { z } from 'zod';
import { expandBaseSchema } from '../../common/condition-trigger/expand';

export const expandConditionSchema = expandBaseSchema.extend({
  condition: z.literal('expand'),
});
