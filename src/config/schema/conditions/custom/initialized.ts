import { z } from 'zod';
import { initializedBaseSchema } from '../../common/condition-trigger/initialized';

export const initializedConditionSchema = initializedBaseSchema.extend({
  condition: z.literal('initialized'),
});
