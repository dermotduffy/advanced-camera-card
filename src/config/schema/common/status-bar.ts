import { z } from 'zod';
import { STATUS_BAR_PRIORITY_DEFAULT, STATUS_BAR_PRIORITY_MAX } from './const';

export const statusBarItemBaseSchema = z.object({
  enabled: z.boolean().default(true).optional(),
  priority: z
    .number()
    .min(0)
    .max(STATUS_BAR_PRIORITY_MAX)
    .default(STATUS_BAR_PRIORITY_DEFAULT)
    .optional(),
});
