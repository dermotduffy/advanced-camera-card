import { z } from 'zod';
import { interactionBaseSchema } from '../../common/condition-trigger/interaction';

export const interactionConditionSchema = interactionBaseSchema.extend({
  condition: z.literal('interaction'),
});
