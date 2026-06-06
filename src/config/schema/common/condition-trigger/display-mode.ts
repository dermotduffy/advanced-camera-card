import { z } from 'zod';
import { viewDisplayModeSchema } from '../display';

export const displayModeBaseSchema = z.object({
  display_mode: viewDisplayModeSchema,
});
