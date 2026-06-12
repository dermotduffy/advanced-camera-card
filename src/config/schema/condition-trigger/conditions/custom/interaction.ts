import { z } from 'zod';
import { interactionBaseSchema } from '../../common/interaction';

export const interactionConditionSchema = interactionBaseSchema.extend({
  condition: z.literal('interaction'),
});
