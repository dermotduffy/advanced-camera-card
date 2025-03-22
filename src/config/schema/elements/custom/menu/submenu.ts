import { z } from 'zod';
import { elementsBaseSchema } from '../../base';
import { iconSchema } from '../../stock/icon';
import { menuBaseSchema } from './base';

export const menuSubmenuItemSchema = elementsBaseSchema.extend({
  entity: z.string().optional(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
  selected: z.boolean().default(false),
  subtitle: z.string().optional(),
  enabled: z.boolean().default(true),
});
export type MenuSubmenuItem = z.infer<typeof menuSubmenuItemSchema>;

export const menuSubmenuSchema = menuBaseSchema.merge(iconSchema).extend({
  type: z.literal('custom:advanced-camera-card-menu-submenu'),
  items: menuSubmenuItemSchema.array(),
});
export type MenuSubmenu = z.infer<typeof menuSubmenuSchema>;
