import { z } from 'zod';
import { MENU_PRIORITY_DEFAULT, MENU_PRIORITY_MAX } from '../../../common/const';

export const menuBaseSchema = z.object({
  enabled: z.boolean().default(true).optional(),
  inert: z.boolean().optional(),
  priority: z
    .number()
    .min(0)
    .max(MENU_PRIORITY_MAX)
    .default(MENU_PRIORITY_DEFAULT)
    .optional(),
  alignment: z.enum(['matching', 'opposing']).default('matching').optional(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true).optional(),
  permanent: z.boolean().default(false).optional(),
});
