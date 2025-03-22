import { z } from 'zod';
import { actionsBaseSchema } from '../actions/types';

export const elementsBaseSchema = actionsBaseSchema.extend({
  style: z.record(z.string().nullable().or(z.undefined()).or(z.number())).optional(),
  title: z.string().nullable().optional(),
});
