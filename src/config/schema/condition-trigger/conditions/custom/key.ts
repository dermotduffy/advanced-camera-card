import { z } from 'zod';
import { keyBaseSchema } from '../../common/key';
import { conditionBaseSchema } from '../base';

export const keyConditionSchema = keyBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('key'),
    key: z.string(),
  });
