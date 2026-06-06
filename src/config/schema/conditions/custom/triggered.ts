import { z } from 'zod';
import { triggeredBaseSchema } from '../../common/condition-trigger/triggered';

export const triggeredConditionSchema = triggeredBaseSchema.extend({
  condition: z.literal('triggered'),
});
