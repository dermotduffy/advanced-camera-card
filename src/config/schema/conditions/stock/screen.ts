import { z } from 'zod';

// https://www.home-assistant.io/dashboards/conditional/#screen
export const screenConditionSchema = z.object({
  condition: z.literal('screen'),
  media_query: z.string(),
});
