import { z } from 'zod';
import { viewDisplayModeSchema } from '../../../common/display';
import { displayModeBaseSchema } from '../../common/display-mode';
import { conditionBaseSchema } from '../base';

export const displayModeConditionSchema = displayModeBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('display_mode'),
    display_mode: viewDisplayModeSchema,
  });
