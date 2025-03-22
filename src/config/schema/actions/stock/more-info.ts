import { z } from 'zod';
import { actionBaseSchema } from '../base';

export const moreInfoActionSchema = actionBaseSchema.extend({
  action: z.literal('more-info'),
  entity: z.string().optional(),
});
export type MoreInfoActionConfig = z.infer<typeof moreInfoActionSchema>;
