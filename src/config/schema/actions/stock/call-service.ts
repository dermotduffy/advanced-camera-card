import { z } from 'zod';
import { actionBaseSchema } from '../base';
import { targetSchema } from './target';

// Note: call-service is deprecated and will eventually go away. Please use
// perform-action instead.
// See: https://www.home-assistant.io/blog/2024/08/07/release-20248/#goodbye-service-calls-hello-actions-

export const callServiceActionSchema = actionBaseSchema.extend({
  action: z.literal('call-service'),
  service: z.string(),
  data: z.object({}).passthrough().optional(),
  target: targetSchema.optional(),
});
export type CallServiceActionConfig = z.infer<typeof callServiceActionSchema>;
