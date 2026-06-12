import { z } from 'zod';
import { displayModeBaseSchema } from '../../common/display-mode';

export const displayModeConditionSchema = displayModeBaseSchema.extend({
  condition: z.literal('display_mode'),
});
