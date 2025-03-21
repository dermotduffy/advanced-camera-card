import { z } from 'zod';
import { actionBaseSchema } from '../base';

export const noneActionSchema = actionBaseSchema.extend({
  action: z.literal('none'),
});
export type NoneActionConfig = z.infer<typeof noneActionSchema>;
