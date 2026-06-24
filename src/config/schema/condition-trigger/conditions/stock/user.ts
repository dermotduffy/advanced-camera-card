import { z } from 'zod';

import { userBaseSchema } from '../../common/user';
import { conditionBaseSchema } from '../base';

// https://www.home-assistant.io/dashboards/conditional/#user
export const userConditionSchema = userBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('user'),
  });
