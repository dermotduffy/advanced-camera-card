import { z } from 'zod';
import { advancedCameraCardConditionSchema } from './conditions/types';

const overrideSchema = z.object({
  conditions: advancedCameraCardConditionSchema.array(),
  merge: z.looseObject({}).optional(),
  set: z.looseObject({}).optional(),
  delete: z.string().array().optional(),
});
export type Override = z.infer<typeof overrideSchema>;

export const overridesSchema = overrideSchema.array().optional();
