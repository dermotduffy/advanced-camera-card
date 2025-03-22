import { z } from 'zod';

// https://www.home-assistant.io/dashboards/conditional/#numeric-state
export const numericStateConditionSchema = z.object({
  condition: z.literal('numeric_state'),
  entity: z.string(),
  above: z.number().optional(),
  below: z.number().optional(),
});
