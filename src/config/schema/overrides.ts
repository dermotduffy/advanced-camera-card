import { z } from 'zod';
import { advancedCameraCardConditionSchema } from './conditions/types';

const overrideSchema = z.object({
  conditions: advancedCameraCardConditionSchema.array(),
  merge: z.object({}).passthrough().optional(),
  set: z.object({}).passthrough().optional(),
  delete: z.string().array().optional(),
});
export type Override = z.infer<typeof overrideSchema>;

export const overridesSchema = overrideSchema.array().optional();
