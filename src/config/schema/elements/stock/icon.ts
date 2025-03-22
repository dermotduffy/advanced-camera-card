import { z } from 'zod';
import { elementsBaseSchema } from '../base';

// https://www.home-assistant.io/lovelace/picture-elements/#icon-element
export const iconSchema = elementsBaseSchema.extend({
  type: z.literal('icon'),
  icon: z.string(),
  entity: z.string().optional(),
});
