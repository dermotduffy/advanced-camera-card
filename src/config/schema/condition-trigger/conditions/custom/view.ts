import { z } from 'zod';

import { viewBaseSchema } from '../../common/view';
import { conditionBaseSchema } from '../base';

export const viewConditionSchema = viewBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('view'),
    views: z.string().array().min(1),
  });
