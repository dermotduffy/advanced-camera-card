import { z } from 'zod';

import { conditionBaseSchema } from '../base';

// https://www.home-assistant.io/docs/scripts/conditions/#template-condition
export const templateConditionSchema = conditionBaseSchema.extend({
  condition: z.literal('template'),
  value_template: z.string(),
});
