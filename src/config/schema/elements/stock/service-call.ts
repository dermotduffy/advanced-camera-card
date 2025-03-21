import { z } from 'zod';
import { elementsBaseSchema } from '../base';

// https://www.home-assistant.io/lovelace/picture-elements/#service-call-button
export const serviceCallButtonSchema = elementsBaseSchema.extend({
  type: z.literal('service-button'),

  // Title is required for service button.
  title: z.string(),
  service: z.string(),
  service_data: z.object({}).passthrough().optional(),
});
