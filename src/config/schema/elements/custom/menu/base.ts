import { z } from 'zod';

import { buttonBaseSchema } from '../../../common/button';
import { MENU_PRIORITY_DEFAULT, MENU_PRIORITY_MAX } from '../../../common/const';

export const menuBaseSchema = buttonBaseSchema.extend({
  enabled: z.boolean().default(true).optional(),
  inert: z.boolean().optional(),
  priority: z
    .number()
    .min(0)
    .max(MENU_PRIORITY_MAX)
    .default(MENU_PRIORITY_DEFAULT)
    .optional(),
  alignment: z.enum(['matching', 'opposing']).default('matching').optional(),
  state_color: z.boolean().default(true).optional(),
  permanent: z.boolean().default(false).optional(),
});
