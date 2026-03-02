import { z } from 'zod';
import { elementsBaseSchema } from '../base';

// https://www.home-assistant.io/dashboards/picture-elements/#state-badge
export const stateBadgeIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-badge'),
  entity: z.string(),
});
