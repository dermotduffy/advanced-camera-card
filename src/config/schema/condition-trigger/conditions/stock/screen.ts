import { z } from 'zod';

import { screenBaseSchema } from '../../common/screen';
import { conditionBaseSchema } from '../base';

// https://www.home-assistant.io/dashboards/conditional/#screen
export const screenConditionSchema = screenBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('screen'),
  });
