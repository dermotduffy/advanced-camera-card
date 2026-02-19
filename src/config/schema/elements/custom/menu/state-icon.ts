import { z } from 'zod';
import { stateIconSchema } from '../../stock/state-icon';
import { menuBaseSchema } from './base';

export const menuStateIconSchema = menuBaseSchema
  .extend(stateIconSchema.shape)
  .extend({
    type: z.literal('custom:advanced-camera-card-menu-state-icon'),
  })
  .extend(menuBaseSchema.shape);
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;
