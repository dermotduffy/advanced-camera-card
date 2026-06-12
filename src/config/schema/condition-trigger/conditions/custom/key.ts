import { z } from 'zod';
import { keyBaseSchema } from '../../common/key';

export const keyConditionSchema = keyBaseSchema.extend({
  condition: z.literal('key'),
});
