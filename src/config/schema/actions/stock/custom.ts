import { z } from 'zod';
import { actionBaseSchema } from '../base';

export const customActionSchema = actionBaseSchema
  .extend({
    action: z.literal('fire-dom-event'),
  })
  .passthrough();
export type CustomActionConfig = z.infer<typeof customActionSchema>;
