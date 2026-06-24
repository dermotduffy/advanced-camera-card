import { z } from 'zod';

import { initializedBaseSchema } from '../../common/initialized';
import { conditionBaseSchema } from '../base';

export const initializedConditionSchema = initializedBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('initialized'),
  });
