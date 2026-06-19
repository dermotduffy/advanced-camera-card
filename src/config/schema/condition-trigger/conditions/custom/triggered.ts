import { z } from 'zod';
import { triggeredBaseSchema } from '../../common/triggered';
import { conditionBaseSchema } from '../base';

export const triggeredConditionSchema = triggeredBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('triggered'),
  });
