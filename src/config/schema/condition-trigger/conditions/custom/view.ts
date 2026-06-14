import { z } from 'zod';
import { viewBaseSchema } from '../../common/view';
import { conditionBaseSchema } from '../base';

export const viewConditionSchema = viewBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('view'),
    // A `view` condition is an ongoing predicate ("the selected view is one of
    // these"), so it requires at least one view.
    views: z.string().array().min(1),
  });
