import { z } from 'zod';
import { stateIconSchema } from '../../stock/state-icon';
import { menuBaseSchema } from './base';
import { menuSubmenuItemSchema } from './submenu';

export const menuSubmenuSelectSchema = menuBaseSchema
  .extend(stateIconSchema.shape)
  .extend({
    type: z.literal('custom:advanced-camera-card-menu-submenu-select'),
    options: z.record(z.string(), menuSubmenuItemSchema.partial()).optional(),
  });
export type MenuSubmenuSelect = z.infer<typeof menuSubmenuSelectSchema>;
