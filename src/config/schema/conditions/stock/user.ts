import { z } from 'zod';
import { userBaseSchema } from '../../common/condition-trigger/user';

// https://www.home-assistant.io/dashboards/conditional/#user
export const userConditionSchema = userBaseSchema.extend({
  condition: z.literal('user'),
});
