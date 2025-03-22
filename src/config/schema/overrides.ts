import { z } from 'zod';
import { advancedCameraCardConditionSchema } from './conditions/types';

export const overridesSchema = z
  .object({
    conditions: advancedCameraCardConditionSchema.array(),
    merge: z.object({}).passthrough().optional(),
    set: z.object({}).passthrough().optional(),
    delete: z.string().array().optional(),
  })
  .array()
  .optional();
export type Overrides = z.infer<typeof overridesSchema>;
