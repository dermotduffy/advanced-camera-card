import { z } from 'zod';
import { actionBaseSchema } from '../base';
import { targetSchema } from './target';

export const performActionActionSchema = actionBaseSchema.extend({
  action: z.literal('perform-action'),
  perform_action: z.string(),
  data: z.object({}).passthrough().optional(),
  target: targetSchema.optional(),
});
export type PerformActionActionConfig = z.infer<typeof performActionActionSchema>;
