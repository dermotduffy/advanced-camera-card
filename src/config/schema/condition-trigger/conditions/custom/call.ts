import { z } from 'zod';
import { callBaseSchema } from '../../common/call';

export const callConditionSchema = callBaseSchema.extend({
  condition: z.literal('call'),
});
