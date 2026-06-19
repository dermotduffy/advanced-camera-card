import { z } from 'zod';
import { initializedBaseSchema } from '../../common/initialized';
import { triggerBaseSchema } from '../base';

export const initializedTriggerSchema = initializedBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('initialized') });
