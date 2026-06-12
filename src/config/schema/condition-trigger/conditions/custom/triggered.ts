import { z } from 'zod';
import { triggeredBaseSchema } from '../../common/triggered';

export const triggeredConditionSchema = triggeredBaseSchema.extend({
  condition: z.literal('triggered'),
});
