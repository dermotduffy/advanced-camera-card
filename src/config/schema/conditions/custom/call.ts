import { z } from 'zod';
import { callBaseSchema } from '../../common/condition-trigger/call';

export const callConditionSchema = callBaseSchema.extend({
  condition: z.literal('call'),
});
