import { z } from 'zod';
import { expandBaseSchema } from '../../common/expand';
import { conditionBaseSchema } from '../base';

export const expandConditionSchema = expandBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('expand'),
    expand: z.boolean(),
  });
