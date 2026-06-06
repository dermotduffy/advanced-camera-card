import { z } from 'zod';
import { screenBaseSchema } from '../../common/condition-trigger/screen';

// https://www.home-assistant.io/dashboards/conditional/#screen
export const screenConditionSchema = screenBaseSchema.extend({
  condition: z.literal('screen'),
});
