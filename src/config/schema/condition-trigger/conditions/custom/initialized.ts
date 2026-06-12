import { z } from 'zod';
import { initializedBaseSchema } from '../../common/initialized';

export const initializedConditionSchema = initializedBaseSchema.extend({
  condition: z.literal('initialized'),
});
