import { z } from 'zod';
import { elementsBaseSchema } from '../base';

// https://www.home-assistant.io/lovelace/picture-elements/#state-label
export const stateLabelSchema = elementsBaseSchema.extend({
  type: z.literal('state-label'),
  entity: z.string(),
  attribute: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});
