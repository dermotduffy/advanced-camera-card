import { z } from 'zod';
import { viewDisplayModeSchema } from '../../common/display';

export const displayModeBaseSchema = z.object({
  display_mode: viewDisplayModeSchema.optional(),
});
export type DisplayModeBase = z.infer<typeof displayModeBaseSchema>;
