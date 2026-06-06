import { z } from 'zod';
import { keyBaseSchema } from '../../common/condition-trigger/key';

export const keyConditionSchema = keyBaseSchema.extend({
  condition: z.literal('key'),
});
