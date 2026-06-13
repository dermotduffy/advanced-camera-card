import { z } from 'zod';
import { configBaseSchema } from '../../common/config';
import { conditionBaseSchema } from '../base';

export const configConditionSchema = configBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('config'),
  });
