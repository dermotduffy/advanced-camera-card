import { z } from 'zod';

// https://www.home-assistant.io/dashboards/conditional/#state
export const stateConditionSchema = z.object({
  // If the condition is not specified, a state condition is assumed. This
  // allows the syntax to match a picture elements conditional:
  // https://www.home-assistant.io/dashboards/picture-elements/#conditional-element
  condition: z.literal('state').optional(),
  entity: z.string(),
  state: z.string().or(z.string().array()).optional(),
  state_not: z.string().or(z.string().array()).optional(),
});
