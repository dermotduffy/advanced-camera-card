import { z } from 'zod';

import { actionsBaseSchema } from '../actions/types';
import { styleSchema } from '../common/style';

export const elementsBaseSchema = actionsBaseSchema.extend({
  style: styleSchema.optional(),
  title: z.string().nullable().optional(),
});
