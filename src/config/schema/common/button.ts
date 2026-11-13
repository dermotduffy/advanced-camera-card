import { z } from 'zod';

import { styleSchema } from './style';

export const buttonBaseSchema = z.object({
  icon: z.string().optional(),
  in_progress: z.boolean().optional(),
  style: styleSchema.optional(),
});
