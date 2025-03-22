import { z } from 'zod';
import { stateIconSchema } from '../../stock/state-icon';
import { menuBaseSchema } from './base';

export const menuStateIconSchema = menuBaseSchema
  .merge(stateIconSchema)
  .extend({
    type: z.literal('custom:advanced-camera-card-menu-state-icon'),
  })
  .merge(menuBaseSchema);
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;
