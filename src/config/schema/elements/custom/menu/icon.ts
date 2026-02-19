import { z } from 'zod';
import { iconSchema } from '../../stock/icon';
import { menuBaseSchema } from './base';

export const menuIconSchema = menuBaseSchema.extend(iconSchema.shape).extend({
  type: z.literal('custom:advanced-camera-card-menu-icon'),
});
export type MenuIcon = z.infer<typeof menuIconSchema>;
