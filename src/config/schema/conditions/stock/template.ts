import { z } from 'zod';

// https://www.home-assistant.io/docs/scripts/conditions/#template-condition
export const templateConditionSchema = z.object({
  condition: z.literal('template'),
  value_template: z.string(),
});
