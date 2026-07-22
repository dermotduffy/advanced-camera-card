import { z } from 'zod';

import { callBaseSchema, callPhaseMatchSchema } from '../../common/call';
import { conditionBaseSchema } from '../base';

export const callConditionSchema = callBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('call'),
    call: callPhaseMatchSchema,
  });
