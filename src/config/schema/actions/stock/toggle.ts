import { z } from 'zod';
import { actionBaseSchema } from '../base';

export const toggleActionSchema = actionBaseSchema.extend({
  action: z.literal('toggle'),
});
export type ToggleActionConfig = z.infer<typeof toggleActionSchema>;
