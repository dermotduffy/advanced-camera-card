import { z } from 'zod';
import { viewDisplayModeSchema } from '../../common/display';

export const displayModeConditionSchema = z.object({
  condition: z.literal('display_mode'),
  display_mode: viewDisplayModeSchema,
});
