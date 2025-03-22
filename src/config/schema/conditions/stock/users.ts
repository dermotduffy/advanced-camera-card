import { z } from 'zod';

// https://www.home-assistant.io/dashboards/conditional/#user
export const usersConditionSchema = z.object({
  condition: z.literal('user'),
  users: z.string().array().min(1),
});
