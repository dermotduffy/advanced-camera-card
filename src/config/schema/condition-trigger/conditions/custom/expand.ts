import { z } from 'zod';
import { expandBaseSchema } from '../../common/expand';

export const expandConditionSchema = expandBaseSchema.extend({
  condition: z.literal('expand'),
});
