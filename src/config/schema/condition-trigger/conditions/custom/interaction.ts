import { z } from 'zod';
import { interactionBaseSchema } from '../../common/interaction';
import { conditionBaseSchema } from '../base';

export const interactionConditionSchema = interactionBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('interaction'),
  });
