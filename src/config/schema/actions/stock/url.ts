import { z } from 'zod';
import { actionBaseSchema } from '../base';

export const urlActionSchema = actionBaseSchema.extend({
  action: z.literal('url'),
  url_path: z.string(),
});
export type URLActionConfig = z.infer<typeof urlActionSchema>;
