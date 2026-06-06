import { z } from 'zod';
import { configBaseSchema } from '../../common/condition-trigger/config';

export const configConditionSchema = configBaseSchema.extend({
  condition: z.literal('config'),
});
