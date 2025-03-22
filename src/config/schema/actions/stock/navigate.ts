import { z } from 'zod';
import { actionBaseSchema } from '../base';

export const navigateActionSchema = actionBaseSchema.extend({
  action: z.literal('navigate'),
  navigation_path: z.string(),
  navigation_replace: z.boolean().optional(),
});
export type NavigateActionConfig = z.infer<typeof navigateActionSchema>;
