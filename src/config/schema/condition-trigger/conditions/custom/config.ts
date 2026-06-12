import { z } from 'zod';
import { configBaseSchema } from '../../common/config';

export const configConditionSchema = configBaseSchema.extend({
  condition: z.literal('config'),
});
