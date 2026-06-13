import { z } from 'zod';
import { callBaseSchema } from '../../common/call';
import { conditionBaseSchema } from '../base';

export const callConditionSchema = callBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('call'),
  });
