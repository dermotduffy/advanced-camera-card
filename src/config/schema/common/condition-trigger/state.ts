import { z } from 'zod';
import { timePeriodSchema } from '../time-period';

// Fields shared by the `state` condition AND trigger.
export const stateBaseSchema = z.object({
  // Match against an entity attribute instead of its state.
  attribute: z.string().optional(),

  // the match must hold for at least this time period.
  for: timePeriodSchema.optional(),
});
